import { Trash2 } from "lucide-react";
import { useFetcher } from "react-router";
import { Can } from "~/components/can";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type { OrganisationMember } from "~/lib/schema";
import { RoleBadge } from "./role-badge";

interface UsersTableProps {
  members: OrganisationMember[];
  currentUserEmail: string;
}

function MemberRow({
  member,
  currentUserEmail,
}: {
  member: OrganisationMember;
  currentUserEmail: string;
}) {
  const fetcher = useFetcher<{ removeError?: string }>();
  const removing = fetcher.state !== "idle";

  return (
    <TableRow>
      <TableCell className="font-medium">{member.userEmail}</TableCell>
      <TableCell>
        <RoleBadge role={member.role} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {member.invitedBy ?? "—"}
      </TableCell>
      <TableCell className="text-right">
        <Can permission="invite:users">
          {member.userEmail !== currentUserEmail && (
            <fetcher.Form method="post">
              <input type="hidden" name="_intent" value="remove" />
              <input type="hidden" name="email" value={member.userEmail} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                disabled={removing}
              >
                <Trash2 className="size-4" />
              </Button>
            </fetcher.Form>
          )}
        </Can>
      </TableCell>
    </TableRow>
  );
}

export function UsersTable({ members, currentUserEmail }: UsersTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Invited by</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((m) => (
          <MemberRow key={m.id} member={m} currentUserEmail={currentUserEmail} />
        ))}
      </TableBody>
    </Table>
  );
}
