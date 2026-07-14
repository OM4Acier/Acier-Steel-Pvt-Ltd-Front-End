const fs = require("fs");
const path = require("path");
/**
 * create-task-structure.js
 * --------------------------------------
 * Creates a folder + file structure for the tasks module in a Next.js app.
 * Run using:  node create-task-structure.js
 */

// ===== CONFIG =====
const baseDir = process.cwd();

const structure = {
  app: {
    tasks: {
      "page.tsx": "// Main tasks page (role-based view)\n",
      "actions.ts": "// Server actions for API calls\n",
      components: {
        "TaskCard.tsx": "// Employee task card component\n",
        "TaskForm.tsx": "// Quick assign form (admin/ops)\n",
        "TaskList.tsx": "// Task list/grid component\n",
        "TaskStats.tsx": "// Stats cards component\n",
      },
    },
  },
  lib: {
    api: {
      "tasks.ts": "// API client functions for tasks\n",
    },
    types: {
      "task.ts": "// Task interfaces (TypeScript interfaces)\n",
    },
    utils: {
      "task-helpers.ts": "// Helper functions for tasks\n",
    },
  },
};

// ===== HELPER FUNCTION =====
function createStructure(base, obj) {
  for (const name in obj) {
    const targetPath = path.join(base, name);
    const value = obj[name];

    if (typeof value === "object") {
      // Create directory
      if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });
      createStructure(targetPath, value);
    } else {
      // Create file with default content
      fs.writeFileSync(targetPath, value);
      console.log(`📝 Created file: ${targetPath}`);
    }
  }
}

// ===== EXECUTE =====
console.log("📁 Creating task module structure...\n");
createStructure(baseDir, structure);
console.log("\n✅ Task module structure created successfully!");
