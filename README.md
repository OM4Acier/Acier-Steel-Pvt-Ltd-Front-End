This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

https://student.overbookedacademy.com/programs/session-video/276

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Project Structure

### `app/` - Application Pages & Features
The core routing and feature-specific logic using Next.js App Router.
- `(auth)/` - Authentication routes: `login`, `forgot-password`.
- `attendance/` - Attendance tracking and management.
- `customers/` - Customer directory with `CustomerDialog` and `CustomerForm`.
- `leads/` & `leads-center/` - Lead management and tracking.
- `orders/` - Comprehensive order management:
  - `apiService.ts`: Order-specific API calls.
  - `generateOrderPdf.ts` & `pdfConfig.ts`: PDF generation logic.
  - `components/`: `OrderCard`, `OrderDetailsDialog`, `UserManagementPanel`.
- `tasks/` - Kanban-style task management:
  - `components/`: `KanbanColumn`, `TaskCard`, `ActivityLog`.
  - `hooks/`: `use-keyboard-shortcuts`.
- `purchases/`, `reports/`, `visitors/` - Other business modules.

### `components/` - Shared UI Components
- `ui/` - Low-level UI primitives (Button, Input, Dialog, etc.) powered by shadcn/ui.
- `RBAC/` - `ProtectedComponent` for role-based visibility.
- **Layout**: `AppShell`, `NavBar`, `NavButton`, `PageToolbar`.
- **Media**: `AudioRecorder`, `AudioPlayer`, `AudioManager`.
- **Forms**: `RichTextarea`, `FileUploadSection`.

### `lib/` - Core Logic & Utilities
- `api/` - Centralized API client (`client.ts`) and endpoint definitions.
- `auth/` - Authentication logic, token management, and cloud auth checks.
- `config/` - Application constants for colors, permissions, and routes.
- `utils/` - Shared helper functions (PDF merging, file uploads, task helpers).
- `validations/` - Zod schemas for form validation (e.g., `customer.schema.ts`).

### `hooks/` - Custom React Hooks
- `useRBAC.ts`: Role-based access control logic.
- `useSession.ts`: User session management.
- `useTokenExpiry.ts`: JWT token expiration handling.
- `useConfigCache.ts`: Local caching for configuration data.

### `types/` - TypeScript Definitions
- `auth.types.ts`: User and session types.
- `rbac.types.ts`: Roles and permissions definitions.
- `fileUpload.ts`: Types for file handling.

### `context/` & `providers/`
- `SessionProvider.tsx`: Context provider for user sessions.
- `LoadingContext.tsx`: Global loading state management.
- `NavbarExtensionContext.tsx`: Dynamic navbar actions.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
