// Package directory owns CHINT master-data imports without changing upstream organization tables.
package directory

import "time"

const MaxRecords = 20000

// Batch is a versioned snapshot or explicit delta. Absence never means deletion.
type Batch struct {
	SourceID      string              `json:"source_id"`
	BatchID       string              `json:"batch_id"`
	Sequence      int64               `json:"sequence"`
	Mode          string              `json:"mode"`
	Complete      bool                `json:"complete"`
	Organizations []OrganizationInput `json:"organizations"`
	People        []PersonInput       `json:"people"`
}

type OrganizationInput struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	ParentID string `json:"parent_id"`
	Status   string `json:"status"`
}

type PersonInput struct {
	ID               string           `json:"id"`
	Name             string           `json:"name"`
	OrgID            string           `json:"org_id"`
	Status           string           `json:"status"`
	FeishuIdentities []FeishuIdentity `json:"feishu_identities"`
}

type FeishuIdentity struct {
	TenantID string `json:"tenant_id"`
	UserID   string `json:"user_id"`
}

type Organization struct {
	SourceID  string    `json:"source_id" gorm:"primaryKey;size:128"`
	ID        string    `json:"id" gorm:"primaryKey;size:128"`
	Name      string    `json:"name" gorm:"size:255;not null"`
	ParentID  string    `json:"parent_id" gorm:"size:128"`
	Status    string    `json:"status" gorm:"size:16;not null"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Organization) TableName() string { return "chint_directory_organizations" }

type Person struct {
	SourceID  string    `json:"source_id" gorm:"primaryKey;size:128"`
	ID        string    `json:"id" gorm:"primaryKey;size:128"`
	Name      string    `json:"name" gorm:"size:255;not null"`
	OrgID     string    `json:"org_id" gorm:"size:128;index"`
	Status    string    `json:"status" gorm:"size:16;not null"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Person) TableName() string { return "chint_directory_people" }

type Identity struct {
	SourceID string `json:"source_id" gorm:"primaryKey;size:128"`
	TenantID string `json:"tenant_id" gorm:"primaryKey;size:128"`
	UserID   string `json:"user_id" gorm:"primaryKey;size:128"`
	PersonID string `json:"person_id" gorm:"size:128;index;not null"`
}

func (Identity) TableName() string { return "chint_directory_feishu_identities" }

type Source struct {
	ID       string `json:"id" gorm:"primaryKey;size:128"`
	Sequence int64  `json:"sequence"`
}

func (Source) TableName() string { return "chint_directory_sources" }

type Issue struct {
	Kind    string `json:"kind"`
	ID      string `json:"id"`
	Message string `json:"message"`
}

type Report struct {
	SourceID      string    `json:"source_id" gorm:"primaryKey;size:128"`
	BatchID       string    `json:"batch_id" gorm:"primaryKey;size:128"`
	Sequence      int64     `json:"sequence"`
	Digest        string    `json:"-" gorm:"size:64"`
	Status        string    `json:"status" gorm:"size:16"`
	Actor         string    `json:"actor" gorm:"size:128"`
	Organizations int       `json:"organizations"`
	People        int       `json:"people"`
	IssuesJSON    string    `json:"-" gorm:"type:text"`
	IssueCount    int       `json:"issue_count"`
	Issues        []Issue   `json:"issues" gorm:"-"`
	CreatedAt     time.Time `json:"created_at"`
	Replay        bool      `json:"replay" gorm:"-"`
	DryRun        bool      `json:"dry_run" gorm:"-"`
}

func (Report) TableName() string { return "chint_directory_batches" }

type Binding struct {
	SourceID  string    `json:"source_id" gorm:"primaryKey;size:128"`
	PersonID  string    `json:"person_id" gorm:"primaryKey;size:128"`
	UserID    string    `json:"user_id" gorm:"uniqueIndex;size:36;not null"`
	Actor     string    `json:"actor" gorm:"size:128"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Binding) TableName() string { return "chint_directory_account_bindings" }

type BindingAudit struct {
	ID        uint64    `json:"id" gorm:"primaryKey;autoIncrement"`
	SourceID  string    `json:"source_id" gorm:"size:128"`
	PersonID  string    `json:"person_id" gorm:"size:128"`
	UserID    string    `json:"user_id" gorm:"size:36"`
	Action    string    `json:"action" gorm:"size:16"`
	Actor     string    `json:"actor" gorm:"size:128"`
	CreatedAt time.Time `json:"created_at"`
}

func (BindingAudit) TableName() string { return "chint_directory_binding_audits" }

// Suspension is an operator override; daily imports cannot silently clear it.
type Suspension struct {
	SourceID  string    `json:"source_id" gorm:"primaryKey;size:128"`
	PersonID  string    `json:"person_id" gorm:"primaryKey;size:128"`
	Active    bool      `json:"active"`
	Reason    string    `json:"reason" gorm:"size:500"`
	Actor     string    `json:"actor" gorm:"size:128"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Suspension) TableName() string { return "chint_directory_suspensions" }
