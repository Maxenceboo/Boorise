import { useAction, useMutation, useQuery } from "convex/react";
import type { FormEvent } from "react";
import { useState } from "react";
import { BriefcaseBusiness, Clock3, FileSearch, MailPlus, RefreshCw, ShieldCheck, Trash2, UserRoundPlus, X } from "lucide-react";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Badge, Button, DataTable, Field, Notice, PageHeader, Panel, SelectInput, StatCard, TextInput } from "@/components/ui/app";
import { useToast } from "@/components/ui/toast-context";
import { friendlyError } from "@/lib/errors";
import { formatDate } from "@/lib/format";

type TeamRole = "owner" | "admin" | "sales" | "readonly" | "member";
type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";
type InviteRole = "admin" | "sales" | "readonly";

export function TeamPage() {
  const toast = useToast();
  const team = useQuery(api.app.team);
  const activity = useQuery(api.app.activityLog);
  const inviteMember = useAction(api.app.inviteMember);
  const resendInvitation = useAction(api.app.resendInvitation);
  const inviteAccountant = useAction(api.app.inviteAccountant);
  const resendAccountantInvitation = useAction(api.app.resendAccountantInvitation);
  const updateMemberRole = useMutation(api.app.updateMemberRole);
  const removeMember = useMutation(api.app.removeMember);
  const revokeInvitation = useMutation(api.app.revokeInvitation);
  const revokeAccountantInvitation = useMutation(api.app.revokeAccountantInvitation);
  const revokeAccountantAccess = useMutation(api.app.revokeAccountantAccess);
  const [notice, setNotice] = useState<{ kind: "success" | "error" | "info"; message: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const currentRole = normalizeRole(team?.currentRole);
  const canManageTeam = currentRole === "owner" || currentRole === "admin";
  const canManageRoles = currentRole === "owner";
  const pendingInvitations = team?.invitations.filter((invitation) => displayInvitationStatus(invitation) === "pending") ?? [];
  const pendingAccountantInvitations = team?.accountantInvitations.filter((invitation) => displayInvitationStatus(invitation) === "pending") ?? [];

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("inviteEmail") ?? "");
    const role = String(data.get("inviteRole") ?? "sales") as InviteRole;
    setPending("invite");
    try {
      await inviteMember({ email, role });
      event.currentTarget.reset();
      setNotice({ kind: "success", message: "Invitation envoyee." });
    } catch (err) {
      const message = friendlyError(err, "Invitation impossible.");
      setNotice({ kind: "error", message });
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  async function changeRole(memberId: Id<"organizationMembers">, role: InviteRole) {
    setNotice(null);
    setPending(memberId);
    try {
      await updateMemberRole({ memberId, role });
      setNotice({ kind: "success", message: "Role mis a jour." });
    } catch (err) {
      const message = friendlyError(err, "Modification impossible.");
      setNotice({ kind: "error", message });
      toast.error(message);
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
      const message = friendlyError(err, "Suppression impossible.");
      setNotice({ kind: "error", message });
      toast.error(message);
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
      const message = friendlyError(err, "Revocation impossible.");
      setNotice({ kind: "error", message });
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  async function handleInviteAccountant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("accountantEmail") ?? "");
    setPending("invite-accountant");
    try {
      await inviteAccountant({ email });
      event.currentTarget.reset();
      setNotice({ kind: "success", message: "Invitation comptable envoyee." });
    } catch (err) {
      const message = friendlyError(err, "Invitation comptable impossible.");
      setNotice({ kind: "error", message });
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  async function resend(invitationId: Id<"organizationInvitations">) {
    setNotice(null);
    setPending(`resend-${invitationId}`);
    try {
      await resendInvitation({ invitationId });
      setNotice({ kind: "success", message: "Invitation renvoyee avec une nouvelle expiration." });
    } catch (err) {
      const message = friendlyError(err, "Renvoi impossible.");
      setNotice({ kind: "error", message });
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  async function cancelAccountantInvitation(invitationId: Id<"accountantInvitations">) {
    setNotice(null);
    setPending(invitationId);
    try {
      await revokeAccountantInvitation({ invitationId });
      setNotice({ kind: "success", message: "Invitation comptable revoquee." });
    } catch (err) {
      const message = friendlyError(err, "Revocation impossible.");
      setNotice({ kind: "error", message });
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  async function resendAccountant(invitationId: Id<"accountantInvitations">) {
    setNotice(null);
    setPending(`resend-accountant-${invitationId}`);
    try {
      await resendAccountantInvitation({ invitationId });
      setNotice({ kind: "success", message: "Invitation comptable renvoyee avec une nouvelle expiration." });
    } catch (err) {
      const message = friendlyError(err, "Renvoi impossible.");
      setNotice({ kind: "error", message });
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  async function removeAccountantAccess(accessId: Id<"accountantAccesses">) {
    setNotice(null);
    setPending(accessId);
    try {
      await revokeAccountantAccess({ accessId });
      setNotice({ kind: "success", message: "Acces comptable retire." });
    } catch (err) {
      const message = friendlyError(err, "Retrait impossible.");
      setNotice({ kind: "error", message });
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipe"
        description="Invite les collaborateurs, attribue les roles et garde le controle sur les acces a l'ERP."
      />

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard icon={<UserRoundPlus className="h-4 w-4" />} label="Membres actifs" value={team?.members.length ?? "..."} detail="Un compte = une entreprise" />
        <StatCard icon={<MailPlus className="h-4 w-4" />} label="Invitations" value={pendingInvitations.length} detail="Liens valables 7 jours" tone="amber" />
        <StatCard icon={<BriefcaseBusiness className="h-4 w-4" />} label="Comptables" value={team?.accountantAccesses.length ?? "..."} detail={`${pendingAccountantInvitations.length} invitation(s)`} tone="cyan" />
        <StatCard icon={<ShieldCheck className="h-4 w-4" />} label="Ton role" value={team ? roleLabel(team.currentRole) : "..."} detail="Droits appliques au backend" tone="rose" />
      </div>

      <Panel title="Droits disponibles" description="Les roles sont appliques cote serveur, pas seulement dans l'interface.">
        <div className="role-matrix">
          <RoleCard role="Proprietaire" detail="Tout l'ERP, membres, roles, entreprise et facturation." />
          <RoleCard role="Admin" detail="Parametrage, catalogue, equipe hors proprietaire et operations." />
          <RoleCard role="Commercial" detail="Clients, devis, suivi commercial et factures. Pas de catalogue ni roles." />
          <RoleCard role="Lecture seule" detail="Consultation uniquement. Aucune creation, modification ou suppression." />
        </div>
      </Panel>

      <Panel
        title="Comptables externes"
        description="Acces lecture seule separe de l'equipe interne. Un comptable peut suivre plusieurs entreprises et ne peut pas modifier les donnees."
      >
        {notice ? <Notice kind={notice.kind}>{notice.message}</Notice> : null}
        {!team ? (
          <div className="empty-state"><strong>Chargement...</strong></div>
        ) : canManageTeam ? (
          <form className="form-grid" onSubmit={handleInviteAccountant}>
            <Field label="Email comptable" required hint="Le comptable recevra un lien dedie, different des invitations collaborateurs.">
              <TextInput name="accountantEmail" type="email" placeholder="comptable@cabinet.fr" required />
            </Field>
            <div className="flex items-end">
              <Button className="w-full" disabled={pending === "invite-accountant"} type="submit" variant="secondary">
                <BriefcaseBusiness className="h-4 w-4" />
                {pending === "invite-accountant" ? "Envoi..." : "Inviter un comptable"}
              </Button>
            </div>
          </form>
        ) : (
          <Notice kind="info">Seuls le proprietaire et les administrateurs peuvent inviter un comptable externe.</Notice>
        )}

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-black text-[#491474]">Acces actifs</h3>
              <p className="text-xs font-semibold text-[#7a5f6c]">Consultation, PDF et exports uniquement.</p>
            </div>
            <DataTable
              rows={team?.accountantAccesses ?? []}
              rowKey={(access) => access._id}
              density="compact"
              empty={<div className="empty-state"><strong>Aucun comptable externe actif</strong></div>}
              columns={[
                {
                  key: "email",
                  header: "Comptable",
                  sortValue: (access) => access.email,
                  render: (access) => (
                    <div className="min-w-0">
                      <strong className="block truncate text-[#491474]">{access.user?.name ?? access.email}</strong>
                      <span className="block truncate text-xs text-[#7a5f6c]">{access.email}</span>
                    </div>
                  ),
                },
                {
                  key: "createdAt",
                  header: "Depuis",
                  sortValue: (access) => access.createdAt,
                  render: (access) => formatDate(access.createdAt),
                },
                {
                  key: "rights",
                  header: "Droits",
                  sortValue: () => 0,
                  render: () => <Badge tone="cyan"><FileSearch className="mr-1 inline h-3.5 w-3.5" />Lecture seule</Badge>,
                },
                {
                  key: "actions",
                  header: "Actions",
                  sortable: false,
                  render: (access) => canManageTeam ? (
                    <Button disabled={pending === access._id} size="sm" type="button" variant="danger" onClick={() => void removeAccountantAccess(access._id)}>
                      <Trash2 className="h-4 w-4" />
                      Retirer
                    </Button>
                  ) : null,
                },
              ]}
            />
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-black text-[#491474]">Invitations comptables</h3>
              <p className="text-xs font-semibold text-[#7a5f6c]">Expiration visible, renvoi possible, revocation si besoin.</p>
            </div>
            <DataTable
              rows={team?.accountantInvitations ?? []}
              rowKey={(invitation) => invitation._id}
              density="compact"
              empty={<div className="empty-state"><strong>Aucune invitation comptable</strong></div>}
              columns={[
                {
                  key: "email",
                  header: "Email",
                  sortValue: (invitation) => invitation.email,
                  render: (invitation) => <strong className="text-[#491474]">{invitation.email}</strong>,
                },
                {
                  key: "status",
                  header: "Statut",
                  sortValue: (invitation) => invitationStatusOrder(displayInvitationStatus(invitation)),
                  render: (invitation) => <Badge tone={displayInvitationStatus(invitation) === "pending" ? "amber" : "slate"}>{invitationStatusLabel(displayInvitationStatus(invitation))}</Badge>,
                },
                {
                  key: "expiresAt",
                  header: "Expiration",
                  sortValue: (invitation) => invitation.expiresAt,
                  render: (invitation) => <ExpirationCell expiresAt={invitation.expiresAt} />,
                },
                {
                  key: "actions",
                  header: "Actions",
                  sortable: false,
                  render: (invitation) => canManageTeam && invitation.status !== "accepted" ? (
                    <div className="table-actions">
                      <Button disabled={pending === `resend-accountant-${invitation._id}`} size="sm" type="button" variant="outline" onClick={() => void resendAccountant(invitation._id)}>
                        <RefreshCw className="h-4 w-4" />
                        Renvoyer
                      </Button>
                      {displayInvitationStatus(invitation) === "pending" ? (
                        <Button disabled={pending === invitation._id} size="sm" type="button" variant="danger" onClick={() => void cancelAccountantInvitation(invitation._id)}>
                          <X className="h-4 w-4" />
                          Revoquer
                        </Button>
                      ) : null}
                    </div>
                  ) : null,
                },
              ]}
            />
          </section>
        </div>
      </Panel>

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
              <SelectInput name="inviteRole" defaultValue="sales">
                <option value="sales">Commercial</option>
                <option value="readonly">Lecture seule</option>
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
                render: (member) => <Badge tone={roleTone(member.role)}>{roleLabel(member.role)}</Badge>,
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
                        onChange={(event) => void changeRole(member._id, event.target.value as InviteRole)}
                      >
                        <option value="sales">Commercial</option>
                        <option value="readonly">Lecture seule</option>
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

      <Panel title="Invitations" description="Expiration visible, renvoi possible, revocation si l'acces ne doit plus etre donne.">
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
                render: (invitation) => <Badge tone={roleTone(invitation.role)}>{roleLabel(invitation.role)}</Badge>,
              },
              {
                key: "status",
                header: "Statut",
                sortValue: (invitation) => invitationStatusOrder(displayInvitationStatus(invitation)),
                render: (invitation) => <Badge tone={displayInvitationStatus(invitation) === "pending" ? "amber" : "slate"}>{invitationStatusLabel(displayInvitationStatus(invitation))}</Badge>,
              },
              {
                key: "expiresAt",
                header: "Expiration",
                sortValue: (invitation) => invitation.expiresAt,
                render: (invitation) => <ExpirationCell expiresAt={invitation.expiresAt} />,
              },
              {
                key: "actions",
                header: "Actions",
                sortable: false,
                render: (invitation) => canManageTeam && invitation.status !== "accepted" ? (
                  <div className="table-actions">
                    <Button disabled={pending === `resend-${invitation._id}`} size="sm" type="button" variant="outline" onClick={() => void resend(invitation._id)}>
                      <RefreshCw className="h-4 w-4" />
                      Renvoyer
                    </Button>
                    {displayInvitationStatus(invitation) === "pending" ? (
                      <Button disabled={pending === invitation._id} size="sm" type="button" variant="danger" onClick={() => void cancelInvitation(invitation._id)}>
                        <X className="h-4 w-4" />
                        Revoquer
                      </Button>
                    ) : null}
                  </div>
                ) : null,
              },
            ]}
          />
        )}
      </Panel>

      <Panel title="Journal d'activite" description="Dernieres modifications effectuees dans l'entreprise.">
        <DataTable
          rows={activity ?? []}
          rowKey={(entry) => entry._id}
          density="compact"
          loading={activity === undefined}
          empty={<div className="empty-state"><strong>Aucune activite pour le moment</strong></div>}
          columns={[
            {
              key: "date",
              header: "Date",
              sortValue: (entry) => entry.createdAt,
              render: (entry) => formatDateTime(entry.createdAt),
            },
            {
              key: "actor",
              header: "Qui",
              sortValue: (entry) => entry.actorEmail ?? entry.actorName ?? "",
              render: (entry) => (
                <div className="min-w-0">
                  <strong className="block truncate text-[#491474]">{entry.actorName ?? entry.actorEmail ?? "Systeme"}</strong>
                  {entry.actorEmail ? <span className="block truncate text-xs text-[#7a5f6c]">{entry.actorEmail}</span> : null}
                </div>
              ),
            },
            {
              key: "summary",
              header: "Action",
              sortValue: (entry) => entry.summary,
              render: (entry) => <span>{entry.summary}</span>,
            },
            {
              key: "resource",
              header: "Module",
              sortValue: (entry) => entry.resourceType,
              render: (entry) => <Badge tone="slate">{resourceLabel(entry.resourceType)}</Badge>,
            },
          ]}
        />
      </Panel>
    </div>
  );
}

function RoleCard({ role, detail }: { role: string; detail: string }) {
  return (
    <section className="role-card">
      <ShieldCheck className="h-4 w-4" />
      <strong>{role}</strong>
      <span>{detail}</span>
    </section>
  );
}

function roleLabel(role: TeamRole) {
  const normalized = normalizeRole(role);
  if (normalized === "owner") {
    return "Proprietaire";
  }
  if (normalized === "admin") {
    return "Administrateur";
  }
  if (normalized === "readonly") {
    return "Lecture seule";
  }
  return "Commercial";
}

function roleOrder(role: TeamRole) {
  const normalized = normalizeRole(role);
  return normalized === "owner" ? 0 : normalized === "admin" ? 1 : normalized === "sales" ? 2 : 3;
}

function roleTone(role: TeamRole) {
  const normalized = normalizeRole(role);
  return normalized === "owner" ? "rose" : normalized === "admin" ? "indigo" : normalized === "sales" ? "cyan" : "slate";
}

function normalizeRole(role: TeamRole | undefined): Exclude<TeamRole, "member"> | undefined {
  return role === "member" ? "sales" : role;
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

function displayInvitationStatus(invitation: { status: InvitationStatus; expiresAt: number }) {
  if (invitation.status === "pending" && invitation.expiresAt < Date.now()) {
    return "expired";
  }
  return invitation.status;
}

function ExpirationCell({ expiresAt }: { expiresAt: number }) {
  const days = daysUntil(expiresAt);
  const late = days < 0;
  return (
    <span className={late ? "due-date due-date-late" : days <= 2 ? "due-date due-date-soon" : "due-date"}>
      <Clock3 className="h-3.5 w-3.5" />
      {formatDate(expiresAt)} · {late ? `expiree depuis ${Math.abs(days)} j` : `J-${days}`}
    </span>
  );
}

function daysUntil(timestamp: number) {
  const day = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(timestamp);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / day);
}

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function resourceLabel(resourceType: string) {
  const labels: Record<string, string> = {
    organization: "Entreprise",
    member: "Equipe",
    invitation: "Invitation",
    client: "Client",
    material: "Materiau",
    service: "Prestation",
    quote: "Devis",
    invoice: "Facture",
    quoteTemplate: "Modele",
    accountant: "Comptable",
  };
  return labels[resourceType] ?? resourceType;
}
