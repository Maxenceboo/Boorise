import { useAction, useMutation, useQuery } from "convex/react";
import type { FormEvent } from "react";
import { useState } from "react";
import { MailPlus, ShieldCheck, Trash2, UserRoundPlus, X } from "lucide-react";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Badge, Button, DataTable, Field, Notice, PageHeader, Panel, SelectInput, StatCard, TextInput } from "@/components/ui/app";

type TeamRole = "owner" | "admin" | "member";
type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export function TeamPage() {
  const team = useQuery(api.app.team);
  const inviteMember = useAction(api.app.inviteMember);
  const updateMemberRole = useMutation(api.app.updateMemberRole);
  const removeMember = useMutation(api.app.removeMember);
  const revokeInvitation = useMutation(api.app.revokeInvitation);
  const [notice, setNotice] = useState<{ kind: "success" | "error" | "info"; message: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const canManageTeam = team?.currentRole === "owner" || team?.currentRole === "admin";
  const canManageRoles = team?.currentRole === "owner";
  const pendingInvitations = team?.invitations.filter((invitation) => invitation.status === "pending") ?? [];

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("inviteEmail") ?? "");
    const role = String(data.get("inviteRole") ?? "member") as "admin" | "member";
    setPending("invite");
    try {
      await inviteMember({ email, role });
      event.currentTarget.reset();
      setNotice({ kind: "success", message: "Invitation envoyee." });
    } catch (err) {
      setNotice({ kind: "error", message: err instanceof Error ? err.message : "Invitation impossible" });
    } finally {
      setPending(null);
    }
  }

  async function changeRole(memberId: Id<"organizationMembers">, role: "admin" | "member") {
    setNotice(null);
    setPending(memberId);
    try {
      await updateMemberRole({ memberId, role });
      setNotice({ kind: "success", message: "Role mis a jour." });
    } catch (err) {
      setNotice({ kind: "error", message: err instanceof Error ? err.message : "Modification impossible" });
    } finally {
      setPending(null);
    }
  }

  async function deleteMember(memberId: Id<"organizationMembers">) {
    setNotice(null);
    setPending(memberId);
    try {
      await removeMember({ memberId });
      setNotice({ kind: "success", message: "Membre retire de l'equipe." });
    } catch (err) {
      setNotice({ kind: "error", message: err instanceof Error ? err.message : "Suppression impossible" });
    } finally {
      setPending(null);
    }
  }

  async function cancelInvitation(invitationId: Id<"organizationInvitations">) {
    setNotice(null);
    setPending(invitationId);
    try {
      await revokeInvitation({ invitationId });
      setNotice({ kind: "success", message: "Invitation revoquee." });
    } catch (err) {
      setNotice({ kind: "error", message: err instanceof Error ? err.message : "Revocation impossible" });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Equipe"
        description="Invite les collaborateurs, attribue les roles et garde le controle sur les acces a l'ERP."
      />

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard icon={<UserRoundPlus className="h-4 w-4" />} label="Membres actifs" value={team?.members.length ?? "..."} detail="Un compte = une entreprise" />
        <StatCard icon={<MailPlus className="h-4 w-4" />} label="Invitations" value={pendingInvitations.length} detail="Liens valables 7 jours" tone="amber" />
        <StatCard icon={<ShieldCheck className="h-4 w-4" />} label="Ton role" value={team ? roleLabel(team.currentRole) : "..."} detail="Droits appliques au backend" tone="rose" />
      </div>

      <Panel title="Inviter un collaborateur" description="Le lien est envoye par email. Le collaborateur doit se connecter ou creer un compte pour rejoindre l'entreprise.">
        {notice ? <Notice kind={notice.kind}>{notice.message}</Notice> : null}
        {!team ? (
          <div className="empty-state"><strong>Chargement de l'equipe...</strong></div>
        ) : canManageTeam ? (
          <form className="form-grid" onSubmit={handleInvite}>
            <Field label="Email collaborateur" required>
              <TextInput name="inviteEmail" type="email" placeholder="prenom@entreprise.fr" required />
            </Field>
            <Field label="Role" required>
              <SelectInput name="inviteRole" defaultValue="member">
                <option value="member">Membre</option>
                {team.currentRole === "owner" ? <option value="admin">Administrateur</option> : null}
              </SelectInput>
            </Field>
            <div className="flex items-end">
              <Button className="w-full" disabled={pending === "invite"} type="submit">
                <MailPlus className="h-4 w-4" />
                {pending === "invite" ? "Envoi..." : "Envoyer l'invitation"}
              </Button>
            </div>
          </form>
        ) : (
          <Notice kind="info">Seuls le proprietaire et les administrateurs peuvent inviter des collaborateurs.</Notice>
        )}
      </Panel>

      <Panel title="Membres" description="Le proprietaire peut modifier les roles et retirer des membres. Il doit toujours rester proprietaire de l'equipe.">
        {!team ? (
          <div className="empty-state"><strong>Chargement...</strong></div>
        ) : (
          <DataTable
            rows={team.members}
            rowKey={(member) => member._id}
            density="compact"
            columns={[
              {
                key: "user",
                header: "Membre",
                sortValue: (member) => member.user?.email ?? member.userId,
                render: (member) => (
                  <div className="min-w-0">
                    <strong className="block truncate text-[#491474]">{member.user?.name ?? member.user?.email ?? "Utilisateur"}</strong>
                    <span className="block truncate text-xs text-[#7a5f6c]">{member.user?.email ?? member.userId}</span>
                  </div>
                ),
              },
              {
                key: "role",
                header: "Role",
                sortValue: (member) => roleOrder(member.role),
                render: (member) => <Badge tone={member.role === "owner" ? "rose" : member.role === "admin" ? "indigo" : "slate"}>{roleLabel(member.role)}</Badge>,
              },
              {
                key: "actions",
                header: "Actions",
                sortable: false,
                render: (member) => (
                  <div className="table-actions">
                    {canManageRoles && member.role !== "owner" ? (
                      <SelectInput
                        className="h-9 min-w-32"
                        disabled={pending === member._id}
                        value={member.role}
                        onChange={(event) => void changeRole(member._id, event.target.value as "admin" | "member")}
                      >
                        <option value="member">Membre</option>
                        <option value="admin">Administrateur</option>
                      </SelectInput>
                    ) : null}
                    {canManageRoles && member.role !== "owner" ? (
                      <Button disabled={pending === member._id} size="sm" type="button" variant="danger" onClick={() => void deleteMember(member._id)}>
                        <Trash2 className="h-4 w-4" />
                        Retirer
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Panel>

      <Panel title="Invitations en attente" description="Revoque les invitations qui ne doivent plus donner acces a l'entreprise.">
        {!team ? (
          <div className="empty-state"><strong>Chargement...</strong></div>
        ) : (
          <DataTable
            rows={team.invitations}
            rowKey={(invitation) => invitation._id}
            density="compact"
            empty={<div className="empty-state"><strong>Aucune invitation en attente</strong></div>}
            columns={[
              {
                key: "email",
                header: "Email",
                sortValue: (invitation) => invitation.email,
                render: (invitation) => <strong className="text-[#491474]">{invitation.email}</strong>,
              },
              {
                key: "role",
                header: "Role",
                sortValue: (invitation) => roleOrder(invitation.role),
                render: (invitation) => <Badge tone={invitation.role === "admin" ? "indigo" : "slate"}>{roleLabel(invitation.role)}</Badge>,
              },
              {
                key: "status",
                header: "Statut",
                sortValue: (invitation) => invitationStatusOrder(invitation.status),
                render: (invitation) => <Badge tone={invitation.status === "pending" ? "amber" : "slate"}>{invitationStatusLabel(invitation.status)}</Badge>,
              },
              {
                key: "expiresAt",
                header: "Expiration",
                sortValue: (invitation) => invitation.expiresAt,
                render: (invitation) => new Intl.DateTimeFormat("fr-FR").format(new Date(invitation.expiresAt)),
              },
              {
                key: "actions",
                header: "Actions",
                sortable: false,
                render: (invitation) =>
                  canManageTeam && invitation.status === "pending" ? (
                    <Button disabled={pending === invitation._id} size="sm" type="button" variant="outline" onClick={() => void cancelInvitation(invitation._id)}>
                      <X className="h-4 w-4" />
                      Revoquer
                    </Button>
                  ) : null,
              },
            ]}
          />
        )}
      </Panel>
    </div>
  );
}

function roleLabel(role: TeamRole) {
  if (role === "owner") {
    return "Proprietaire";
  }
  if (role === "admin") {
    return "Administrateur";
  }
  return "Membre";
}

function roleOrder(role: TeamRole) {
  return role === "owner" ? 0 : role === "admin" ? 1 : 2;
}

function invitationStatusLabel(status: InvitationStatus) {
  if (status === "pending") {
    return "En attente";
  }
  if (status === "accepted") {
    return "Acceptee";
  }
  if (status === "revoked") {
    return "Revoquee";
  }
  return "Expiree";
}

function invitationStatusOrder(status: InvitationStatus) {
  return status === "pending" ? 0 : status === "accepted" ? 1 : status === "expired" ? 2 : 3;
}
