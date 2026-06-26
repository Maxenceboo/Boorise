import Google from "@auth/core/providers/google";
import { Email } from "@convex-dev/auth/providers/Email";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

declare const process: {
  env: {
    AUTH_EMAIL_FROM?: string;
    RESEND_API_KEY?: string;
  };
};

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({}),
    Password({
      reset: Email({
        id: "password-reset",
        from: process.env.AUTH_EMAIL_FROM ?? "Boorise <onboarding@resend.dev>",
        maxAge: 60 * 30,
        async sendVerificationRequest({ identifier, url, provider }) {
          const apiKey = process.env.RESEND_API_KEY;
          if (!apiKey) {
            throw new Error("RESEND_API_KEY is required to send password reset emails.");
          }

          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: provider.from,
              to: identifier,
              subject: "Reinitialisation de ton mot de passe Boorise",
              text: [
                "Bonjour,",
                "",
                "Tu as demande la reinitialisation de ton mot de passe Boorise.",
                `Ouvre ce lien pour choisir un nouveau mot de passe : ${url}`,
                "",
                "Ce lien expire dans 30 minutes. Si tu n'es pas a l'origine de cette demande, ignore cet email.",
                "",
                "Boorise",
              ].join("\n"),
              html: resetPasswordEmailHtml(url),
            }),
          });

          if (!response.ok) {
            const detail = await response.text();
            throw new Error(`Resend failed to send password reset email: ${detail}`);
          }
        },
      }),
    }),
  ],
});

function resetPasswordEmailHtml(url: string) {
  const escapedUrl = escapeHtml(url);
  return `
    <div style="margin:0;background:#f7efe4;padding:32px;font-family:Inter,Arial,sans-serif;color:#2a1235">
      <div style="max-width:560px;margin:0 auto;border:1px solid #ddc6aa;border-radius:16px;background:#fffaf3;padding:28px">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;background:#491474;color:#fffaf3;font-weight:900">B</div>
        <h1 style="margin:24px 0 8px;font-size:24px;line-height:1.2;color:#491474">Reinitialisation du mot de passe</h1>
        <p style="margin:0 0 18px;color:#7a5f6c;line-height:1.6">Tu as demande a changer le mot de passe de ton espace Boorise.</p>
        <a href="${escapedUrl}" style="display:inline-block;border-radius:10px;background:#e54715;color:#fffaf3;padding:12px 18px;text-decoration:none;font-weight:800">Choisir un nouveau mot de passe</a>
        <p style="margin:22px 0 0;color:#7a5f6c;line-height:1.6">Ce lien expire dans 30 minutes. Si tu n'es pas a l'origine de cette demande, ignore cet email.</p>
        <p style="margin:18px 0 0;color:#7a5f6c;font-size:13px;line-height:1.5">Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :<br><span style="word-break:break-all;color:#491474">${escapedUrl}</span></p>
      </div>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
