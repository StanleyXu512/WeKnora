package container

import (
	"context"

	"github.com/Tencent/WeKnora/internal/chint/directory"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
)

func startCHINTDirectory(r *directory.Runtime, cleaner interfaces.ResourceCleaner) {
	r.Start()
	cleaner.RegisterWithName("CHINTDirectory", func() error {
		ctx, cancel := context.WithTimeout(context.Background(), cleanupStepTimeout)
		defer cancel()
		r.Stop(ctx)
		return nil
	})
}
