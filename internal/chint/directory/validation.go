package directory

import (
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"
)

var identifier = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,127}$`)

func validID(s string) bool     { return identifier.MatchString(s) }
func validStatus(s string) bool { return s == "active" || s == "inactive" }

// validate checks the merged graph, including records not present in this batch.
func validate(b Batch, existingOrgs []Organization, existingPeople []Person, existingIDs []Identity) ([]Issue, int) {
	issues := []Issue{}
	count := 0
	add := func(kind, id, message string) {
		count++
		if len(issues) < 200 {
			issues = append(issues, Issue{kind, id, message})
		}
	}
	if !validID(b.SourceID) {
		add("batch", "", "source_id 必须是 1–128 位有效标识")
	}
	if !validID(b.BatchID) {
		add("batch", "", "batch_id 必须是 1–128 位有效标识")
	}
	if b.Sequence <= 0 {
		add("batch", b.BatchID, "sequence 必须为正整数且递增")
	}
	if b.Mode != "full" && b.Mode != "delta" {
		add("batch", b.BatchID, "mode 仅支持 full 或 delta")
	}
	if !b.Complete {
		add("batch", b.BatchID, "只接受上游明确标记 complete=true 的完整批次")
	}
	if len(b.Organizations)+len(b.People) == 0 || len(b.Organizations)+len(b.People) > MaxRecords {
		add("batch", b.BatchID, fmt.Sprintf("批次需包含 1–%d 条组织或人员记录", MaxRecords))
	}
	orgs := make(map[string]OrganizationInput)
	for _, o := range existingOrgs {
		orgs[o.ID] = OrganizationInput{o.ID, o.Name, o.ParentID, o.Status}
	}
	seen := map[string]bool{}
	for _, o := range b.Organizations {
		if seen[o.ID] {
			add("organization", o.ID, "组织 ID 重复")
		}
		seen[o.ID] = true
		if !validID(o.ID) || (o.ParentID != "" && !validID(o.ParentID)) {
			add("organization", o.ID, "组织或父组织 ID 无效")
		}
		if strings.TrimSpace(o.Name) == "" || utf8.RuneCountInString(o.Name) > 255 {
			add("organization", o.ID, "名称需包含 1–255 个字符")
		}
		if !validStatus(o.Status) {
			add("organization", o.ID, "status 仅支持 active 或 inactive")
		}
		orgs[o.ID] = o
	}
	for _, o := range orgs {
		if o.ParentID != "" {
			if parent, ok := orgs[o.ParentID]; !ok {
				add("organization", o.ID, "父组织不存在")
			} else if o.Status == "active" && parent.Status != "active" {
				add("organization", o.ID, "有效组织不能属于停用父组织")
			}
		}
	}
	// Iterative traversal avoids stack overflow for deeply nested input.
	colors := map[string]int{}
	for id := range orgs {
		path := []string{}
		current := id
		for current != "" && colors[current] == 0 {
			o, exists := orgs[current]
			if !exists {
				break
			}
			colors[current] = 1
			path = append(path, current)
			current = o.ParentID
		}
		if current != "" && colors[current] == 1 {
			add("organization", current, "组织层级存在循环")
		}
		for _, node := range path {
			colors[node] = 2
		}
	}
	people := map[string]PersonInput{}
	for _, p := range existingPeople {
		people[p.ID] = PersonInput{ID: p.ID, Name: p.Name, OrgID: p.OrgID, Status: p.Status}
	}
	seen = map[string]bool{}
	for _, p := range b.People {
		if seen[p.ID] {
			add("person", p.ID, "人员 ID 重复")
		}
		seen[p.ID] = true
		if !validID(p.ID) || !validID(p.OrgID) {
			add("person", p.ID, "人员或组织 ID 无效")
		}
		if strings.TrimSpace(p.Name) == "" || utf8.RuneCountInString(p.Name) > 255 {
			add("person", p.ID, "名称需包含 1–255 个字符")
		}
		if !validStatus(p.Status) {
			add("person", p.ID, "status 仅支持 active 或 inactive")
		}
		if len(p.FeishuIdentities) > 32 {
			add("person", p.ID, "飞书身份数量超过 32")
		}
		people[p.ID] = p
	}
	for _, p := range people {
		o, ok := orgs[p.OrgID]
		if !ok {
			add("person", p.ID, "所属组织不存在")
		} else if p.Status == "active" && o.Status != "active" {
			add("person", p.ID, "有效人员不能属于停用组织")
		}
	}
	identityOwners := map[string]string{}
	for _, i := range existingIDs {
		if !seen[i.PersonID] || people[i.PersonID].FeishuIdentities == nil {
			identityOwners[i.TenantID+"\x00"+i.UserID] = i.PersonID
		}
	}
	for _, p := range b.People {
		for _, i := range p.FeishuIdentities {
			if !validID(i.TenantID) || !validID(i.UserID) {
				add("person", p.ID, "飞书租户或账号 ID 无效")
			}
			key := i.TenantID + "\x00" + i.UserID
			if owner, ok := identityOwners[key]; ok {
				add("person", p.ID, "飞书身份重复或已属于人员 "+owner)
			} else {
				identityOwners[key] = p.ID
			}
		}
	}
	return issues, count
}
