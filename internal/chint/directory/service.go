package directory

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrConflict = errors.New("批次 ID 已用于不同内容，或版本早于已接收批次")
	ErrInactive = errors.New("集团人员或所属组织已停用")
	ErrBinding  = errors.New("绑定要求有效人员和有效普通本地账号，且账号只能绑定一名人员")
)

type Service struct{ db *gorm.DB }

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

// Migrate is additive and isolated from the upstream migration sequence.
// Future changes must use explicit CHINT versioned migrations.
func (s *Service) Migrate(ctx context.Context) error {
	return s.db.WithContext(ctx).AutoMigrate(&Source{}, &Organization{}, &Person{}, &Identity{}, &Report{}, &Binding{}, &BindingAudit{}, &Suspension{})
}

func (s *Service) Import(ctx context.Context, b Batch, actor string, dryRun bool) (*Report, error) {
	encoded, err := json.Marshal(b)
	if err != nil {
		return nil, err
	}
	hash := sha256.Sum256(encoded)
	r := &Report{SourceID: b.SourceID, BatchID: b.BatchID, Sequence: b.Sequence, Digest: hex.EncodeToString(hash[:]), Actor: actor, Status: "validated", Organizations: len(b.Organizations), People: len(b.People), DryRun: dryRun, CreatedAt: time.Now().UTC()}
	// Reject malformed envelope before using identifiers in persistent rows.
	if !validID(b.SourceID) || !validID(b.BatchID) || len(b.Organizations)+len(b.People) > MaxRecords {
		r.Issues, r.IssueCount = validate(b, nil, nil, nil)
		r.Status = "rejected"
		return r, nil
	}
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if !dryRun {
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&Source{ID: b.SourceID}).Error; err != nil {
				return err
			}
			// This UPDATE locks a per-source row across API and scheduler instances.
			if err := tx.Model(&Source{}).Where("id = ?", b.SourceID).UpdateColumn("sequence", gorm.Expr("sequence")).Error; err != nil {
				return err
			}
		}
		var prior Report
		err := tx.Where("source_id = ? AND batch_id = ?", b.SourceID, b.BatchID).First(&prior).Error
		if err == nil {
			if prior.Digest != r.Digest {
				return ErrConflict
			}
			_ = json.Unmarshal([]byte(prior.IssuesJSON), &prior.Issues)
			prior.Replay = true
			prior.DryRun = dryRun
			r = &prior
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		var source Source
		err = tx.Where("id = ?", b.SourceID).First(&source).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if b.Sequence <= source.Sequence {
			return ErrConflict
		}
		var orgs []Organization
		var people []Person
		var identities []Identity
		if err := tx.Where("source_id = ?", b.SourceID).Find(&orgs).Error; err != nil {
			return err
		}
		if err := tx.Where("source_id = ?", b.SourceID).Find(&people).Error; err != nil {
			return err
		}
		if err := tx.Where("source_id = ?", b.SourceID).Find(&identities).Error; err != nil {
			return err
		}
		r.Issues, r.IssueCount = validate(b, orgs, people, identities)
		if r.IssueCount > 0 {
			r.Status = "rejected"
		} else if !dryRun {
			r.Status = "applied"
			for _, o := range b.Organizations {
				row := Organization{SourceID: b.SourceID, ID: o.ID, Name: o.Name, ParentID: o.ParentID, Status: o.Status}
				if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "source_id"}, {Name: "id"}}, DoUpdates: clause.AssignmentColumns([]string{"name", "parent_id", "status", "updated_at"})}).Create(&row).Error; err != nil {
					return err
				}
			}
			// Remove all identities for changed people first, supporting account transfers in one batch.
			for _, p := range b.People {
				if p.FeishuIdentities == nil {
					continue
				}
				if err := tx.Where("source_id = ? AND person_id = ?", b.SourceID, p.ID).Delete(&Identity{}).Error; err != nil {
					return err
				}
			}
			for _, p := range b.People {
				row := Person{SourceID: b.SourceID, ID: p.ID, Name: p.Name, OrgID: p.OrgID, Status: p.Status}
				if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "source_id"}, {Name: "id"}}, DoUpdates: clause.AssignmentColumns([]string{"name", "org_id", "status", "updated_at"})}).Create(&row).Error; err != nil {
					return err
				}
				for _, i := range p.FeishuIdentities {
					if err := tx.Create(&Identity{SourceID: b.SourceID, TenantID: i.TenantID, UserID: i.UserID, PersonID: p.ID}).Error; err != nil {
						return err
					}
				}
			}
			if err := tx.Model(&Source{}).Where("id = ?", b.SourceID).Update("sequence", b.Sequence).Error; err != nil {
				return err
			}
		}
		if dryRun {
			return nil
		}
		data, err := json.Marshal(r.Issues)
		if err != nil {
			return err
		}
		r.IssuesJSON = string(data)
		return tx.Create(r).Error
	})
	return r, err
}

// Bind explicitly maps an existing account; names/emails never grant identity or privilege.
func (s *Service) Bind(ctx context.Context, source, person, user, actor string) error {
	if !validID(source) || !validID(person) || !validID(user) {
		return ErrBinding
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Serialize bindings and imports for the same master-data source.
		if res := tx.Model(&Source{}).Where("id = ?", source).UpdateColumn("sequence", gorm.Expr("sequence")); res.Error != nil {
			return res.Error
		} else if res.RowsAffected == 0 {
			return ErrBinding
		}
		var p Person
		if err := tx.Where("source_id = ? AND id = ? AND status = ?", source, person, "active").First(&p).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrBinding
			}
			return err
		}
		var org Organization
		if err := tx.Where("source_id = ? AND id = ? AND status = ?", source, p.OrgID, "active").First(&org).Error; err != nil {
			return ErrBinding
		}
		var account struct {
			ID            string
			IsActive      bool
			IsSystemAdmin bool
		}
		if err := tx.Table("users").Select("id, is_active, is_system_admin").Where("id = ? AND deleted_at IS NULL", user).Take(&account).Error; err != nil {
			return ErrBinding
		}
		// Keep bootstrap administrators outside import-driven suspension.
		if !account.IsActive || account.IsSystemAdmin {
			return ErrBinding
		}
		var count int64
		if err := tx.Model(&Binding{}).Where("user_id = ? AND NOT (source_id = ? AND person_id = ?)", user, source, person).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return ErrBinding
		}
		row := Binding{SourceID: source, PersonID: person, UserID: user, Actor: actor}
		if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "source_id"}, {Name: "person_id"}}, DoUpdates: clause.AssignmentColumns([]string{"user_id", "actor", "updated_at"})}).Create(&row).Error; err != nil {
			return fmt.Errorf("account binding: %w", err)
		}
		return tx.Create(&BindingAudit{SourceID: source, PersonID: person, UserID: user, Actor: actor, Action: "bind"}).Error
	})
}

func (s *Service) CheckUser(ctx context.Context, userID string) error {
	var row struct {
		PersonStatus string
		OrgStatus    string
		Suspended    bool
	}
	result := s.db.WithContext(ctx).Table("chint_directory_account_bindings AS b").
		Select("p.status AS person_status, o.status AS org_status, COALESCE(x.active, false) AS suspended").
		Joins("LEFT JOIN chint_directory_people p ON p.source_id = b.source_id AND p.id = b.person_id").
		Joins("LEFT JOIN chint_directory_organizations o ON o.source_id = p.source_id AND o.id = p.org_id").
		Joins("LEFT JOIN chint_directory_suspensions x ON x.source_id = b.source_id AND x.person_id = b.person_id").
		Where("b.user_id = ?", userID).Scan(&row)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected > 0 && (row.PersonStatus != "active" || row.OrgStatus != "active" || row.Suspended) {
		return ErrInactive
	}
	return nil
}

func (s *Service) Suspend(ctx context.Context, source, person, reason, actor string, active bool) error {
	if !validID(source) || !validID(person) || utf8.RuneCountInString(reason) > 500 || (active && strings.TrimSpace(reason) == "") {
		return ErrBinding
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&Source{}).Where("id = ?", source).UpdateColumn("sequence", gorm.Expr("sequence"))
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrBinding
		}
		var p Person
		if err := tx.Where("source_id = ? AND id = ?", source, person).First(&p).Error; err != nil {
			return ErrBinding
		}
		row := Suspension{SourceID: source, PersonID: person, Active: active, Reason: reason, Actor: actor}
		if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "source_id"}, {Name: "person_id"}}, DoUpdates: clause.AssignmentColumns([]string{"active", "reason", "actor", "updated_at"})}).Create(&row).Error; err != nil {
			return err
		}
		action := "resume"
		if active {
			action = "suspend"
		}
		return tx.Create(&BindingAudit{SourceID: source, PersonID: person, Actor: actor, Action: action}).Error
	})
}
func (s *Service) ListSuspensions(ctx context.Context, limit, offset int) ([]Suspension, error) {
	rows := []Suspension{}
	err := s.db.WithContext(ctx).Order("source_id, person_id").Limit(limit).Offset(offset).Find(&rows).Error
	return rows, err
}

func (s *Service) ListOrganizations(ctx context.Context, source string, limit, offset int) ([]Organization, error) {
	rows := []Organization{}
	query := s.db.WithContext(ctx).Order("source_id, id").Limit(limit).Offset(offset)
	if source != "" {
		query = query.Where("source_id = ?", source)
	}
	err := query.Find(&rows).Error
	return rows, err
}
func (s *Service) ListPeople(ctx context.Context, source string, limit, offset int) ([]Person, error) {
	rows := []Person{}
	query := s.db.WithContext(ctx).Order("source_id, id").Limit(limit).Offset(offset)
	if source != "" {
		query = query.Where("source_id = ?", source)
	}
	err := query.Find(&rows).Error
	return rows, err
}
func (s *Service) ListReports(ctx context.Context, limit, offset int) ([]Report, error) {
	rows := []Report{}
	err := s.db.WithContext(ctx).Order("created_at DESC, source_id, batch_id").Limit(limit).Offset(offset).Find(&rows).Error
	for i := range rows {
		_ = json.Unmarshal([]byte(rows[i].IssuesJSON), &rows[i].Issues)
	}
	return rows, err
}
func (s *Service) ListBindings(ctx context.Context, limit, offset int) ([]Binding, error) {
	rows := []Binding{}
	err := s.db.WithContext(ctx).Order("source_id, person_id").Limit(limit).Offset(offset).Find(&rows).Error
	return rows, err
}

func (s *Service) ListIdentities(ctx context.Context, source, tenant string, limit, offset int) ([]Identity, error) {
	rows := []Identity{}
	query := s.db.WithContext(ctx).Order("source_id, tenant_id, user_id").Limit(limit).Offset(offset)
	if source != "" {
		query = query.Where("source_id = ?", source)
	}
	if tenant != "" {
		query = query.Where("tenant_id = ?", tenant)
	}
	err := query.Find(&rows).Error
	return rows, err
}
