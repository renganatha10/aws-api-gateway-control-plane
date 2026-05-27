import { UserPlus } from "lucide-react";
import { useState } from "react";
import { Can } from "~/components/can";
import { Button } from "~/components/ui/button";
import type { OrganisationMember } from "~/lib/schema";
import { InviteUserDialog } from "./invite-user-dialog";
import { UsersTable } from "./users-table";

interface UsersPageProps {
  members: OrganisationMember[];
  currentUserEmail: string;
}

export function UsersPage({ members, currentUserEmail }: UsersPageProps) {
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage who has access to this organisation.
          </p>
        </div>
        <Can permission="invite:users">
          <Button
            className="bg-black hover:bg-gray-900 text-white"
            onClick={() => setShowInvite(true)}
          >
            <UserPlus className="size-4 mr-1.5" />
            Invite User
          </Button>
        </Can>
      </div>

      <UsersTable members={members} currentUserEmail={currentUserEmail} />

      <InviteUserDialog open={showInvite} onOpenChange={setShowInvite} />
    </div>
  );
}
