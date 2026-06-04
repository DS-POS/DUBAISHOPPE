# User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a user management module so the admin can invite staff members, assign roles (admin/staff), and restrict staff from accessing sensitive admin-only features (delete product, delete customer, export reports, settings).

**Architecture:** Supabase Auth handles authentication. A `profiles` table (linked to `auth.users`) stores `name`, `role`, and `is_active`. An admin-only `/settings/users` page lists users and allows role changes. Middleware checks role from the profile and redirects staff away from admin routes. Staff cannot delete products, access settings, or export data.

**Tech Stack:** Next.js 14 App Router, Supabase Auth, Supabase PostgreSQL RLS, TypeScript, shadcn/ui, Tailwind

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `types/database.ts` | Modify | Add `Profile` interface |
| `actions/users.ts` | Create | `getProfiles`, `updateUserRole`, `inviteUser`, `deactivateUser` |
| `lib/get-user-role.ts` | Create | Server helper to get current user role from profiles |
| `middleware.ts` | Modify | Check role for admin-only routes |
| `app/(dashboard)/settings/users/page.tsx` | Create | Admin-only user list + invite form |
| `components/settings/UserList.tsx` | Create | Client component for role toggle + deactivate |

---

### Task 1: DB — `profiles` table

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Check if `profiles` table already exists**

Use Supabase MCP `list_tables` to verify. If it exists, check columns. If missing, create it.

- [ ] **Step 2: Apply Supabase migration**

Use Supabase MCP `apply_migration`:

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email, ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all profiles" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can update profiles" ON profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Backfill existing user as admin
INSERT INTO profiles (id, name, email, role)
SELECT id, COALESCE(raw_user_meta_data->>'name', email, ''), email, 'admin'
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

- [ ] **Step 3: Add `Profile` to `types/database.ts`**

After `User` interface, add:

```typescript
export interface Profile {
  id: string
  name: string
  email: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add types/database.ts
git commit -m "feat(users): profiles table + Profile type + trigger for new users"
```

---

### Task 2: `lib/get-user-role.ts` helper

**Files:**
- Create: `lib/get-user-role.ts`

- [ ] **Step 1: Create helper**

```typescript
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'

export async function getUserRole(): Promise<UserRole | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return (data?.role as UserRole) ?? 'staff'
}

export async function requireAdmin(): Promise<void> {
  const role = await getUserRole()
  if (role !== 'admin') throw new Error('Admin access required')
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/get-user-role.ts
git commit -m "feat(users): getUserRole + requireAdmin server helpers"
```

---

### Task 3: `actions/users.ts` — user management server actions

**Files:**
- Create: `actions/users.ts`

- [ ] **Step 1: Create `actions/users.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Profile, UserRole } from '@/types/database'
import { requireAdmin } from '@/lib/get-user-role'

export async function getProfiles(): Promise<Profile[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Profile[]
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  await requireAdmin()
  const supabase = await createClient()

  // Prevent removing last admin
  if (role === 'staff') {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
    if ((admins ?? []).length <= 1) throw new Error('Cannot remove the last admin.')
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
  if (error) throw new Error(error.message)

  revalidatePath('/settings/users')
}

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  await requireAdmin()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (user?.id === userId) throw new Error('Cannot deactivate your own account.')

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId)
  if (error) throw new Error(error.message)

  revalidatePath('/settings/users')
}
```

Note: Inviting users via email requires Supabase `service_role` key server-side. For now, new staff are created via Supabase Dashboard Auth → Users → Invite user. They auto-get a profile with role `staff` via the trigger.

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add actions/users.ts
git commit -m "feat(users): getProfiles, updateUserRole, setUserActive actions"
```

---

### Task 4: `UserList` client component + users page

**Files:**
- Create: `components/settings/UserList.tsx`
- Create: `app/(dashboard)/settings/users/page.tsx`

- [ ] **Step 1: Create `components/settings/UserList.tsx`**

```typescript
'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { updateUserRole, setUserActive } from '@/actions/users'
import type { Profile, UserRole } from '@/types/database'
import { ShieldIcon, UserIcon, CheckCircle2Icon, XCircleIcon } from 'lucide-react'

interface Props {
  profiles: Profile[]
  currentUserId: string
}

export function UserList({ profiles, currentUserId }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleRoleChange(userId: string, role: UserRole) {
    startTransition(async () => {
      try {
        await updateUserRole(userId, role)
        toast.success('Role updated')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update role')
      }
    })
  }

  function handleActiveToggle(userId: string, isActive: boolean) {
    if (!confirm(`${isActive ? 'Activate' : 'Deactivate'} this user?`)) return
    startTransition(async () => {
      try {
        await setUserActive(userId, isActive)
        toast.success(isActive ? 'User activated' : 'User deactivated')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update user')
      }
    })
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-[#111827]">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-slate-300 text-xs uppercase tracking-wider">User</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-300 text-xs uppercase tracking-wider">Role</th>
            <th className="px-4 py-3 text-center font-semibold text-slate-300 text-xs uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-right font-semibold text-slate-300 text-xs uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((profile, i) => {
            const isSelf = profile.id === currentUserId
            return (
              <tr key={profile.id}
                className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      {profile.role === 'admin'
                        ? <ShieldIcon className="size-4 text-slate-600" />
                        : <UserIcon className="size-4 text-slate-400" />}
                    </div>
                    <div>
                      <p className="font-semibold text-[#111827]">{profile.name || profile.email || 'Unknown'}</p>
                      {profile.email && <p className="text-xs text-slate-400">{profile.email}</p>}
                      {isSelf && <span className="text-xs text-blue-500 font-medium">You</span>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={profile.role}
                    disabled={isPending || isSelf}
                    onChange={e => handleRoleChange(profile.id, e.target.value as UserRole)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  {profile.is_active
                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                        <CheckCircle2Icon className="size-3" /> Active
                      </span>
                    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                        <XCircleIcon className="size-3" /> Inactive
                      </span>
                  }
                </td>
                <td className="px-4 py-3 text-right">
                  {!isSelf && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleActiveToggle(profile.id, !profile.is_active)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40 ${
                        profile.is_active
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-emerald-600 hover:bg-emerald-50'
                      }`}
                    >
                      {profile.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(dashboard)/settings/users/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/get-user-role'
import { getProfiles } from '@/actions/users'
import { UserList } from '@/components/settings/UserList'
import { UsersIcon, InfoIcon } from 'lucide-react'

export default async function UsersPage() {
  const role = await getUserRole()
  if (role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profiles = await getProfiles()

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'Rubik, sans-serif' }}>
            User Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">{profiles.length} user{profiles.length !== 1 ? 's' : ''} registered</p>
        </div>
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 flex gap-3">
        <InfoIcon className="size-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold mb-0.5">Inviting new staff</p>
          <p>Go to <strong>Supabase Dashboard → Authentication → Users → Invite user</strong>. New users automatically get the <em>Staff</em> role. Change their role here after they sign in.</p>
        </div>
      </div>

      <UserList profiles={profiles} currentUserId={user.id} />
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/settings/UserList.tsx app/(dashboard)/settings/users/
git commit -m "feat(users): UserList component + /settings/users admin page"
```

---

### Task 5: Protect admin routes — hide/restrict for staff

**Files:**
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Read `app/(dashboard)/layout.tsx`** to find nav structure.

- [ ] **Step 2: Pass `userRole` to nav so admin-only links are hidden for staff**

In layout, fetch role:

```typescript
import { getUserRole } from '@/lib/get-user-role'

// inside the async layout function:
const userRole = await getUserRole()
```

Pass to any client nav component, or directly filter nav links.

For nav links that are admin-only (Settings, Reports/Tally exports), conditionally render:

```tsx
{userRole === 'admin' && (
  <NavLink href="/settings">Settings</NavLink>
)}
{userRole === 'admin' && (
  <NavLink href="/reports/tally">Tally Export</NavLink>
)}
```

- [ ] **Step 3: Add Users link in settings**

In `app/(dashboard)/settings/page.tsx`, add a card/button linking to `/settings/users` (admin only — page already redirects staff, but hide the link too).

Find the settings page structure, add a section:

```tsx
<Link href="/settings/users"
  className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
      <UsersIcon className="size-5 text-slate-600" />
    </div>
    <div>
      <p className="font-semibold text-slate-800">User Management</p>
      <p className="text-sm text-slate-500">Manage staff accounts and roles</p>
    </div>
  </div>
  <ChevronRightIcon className="size-5 text-slate-400" />
</Link>
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/layout.tsx app/(dashboard)/settings/
git commit -m "feat(users): hide admin nav for staff + users link in settings"
```

---

### Verification Checklist

- [ ] Navigate to `/settings/users` as admin — user list shows current user
- [ ] Create a second user via Supabase Dashboard Auth → Invite user
- [ ] Second user logs in — profile auto-created with role `staff`
- [ ] As admin, change second user role to `admin` → verify role updates
- [ ] Staff user logs in — Settings link hidden in nav
- [ ] `/settings/users` as staff → redirects to `/dashboard`
- [ ] Cannot remove last admin (error toast shown)
