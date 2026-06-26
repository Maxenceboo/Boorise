const genericFallback = "Une erreur est survenue. Reessaie dans un instant.";

const friendlyRules: Array<[RegExp, string]> = [
  [/Failed to fetch|NetworkError|fetch/i, "Connexion impossible. Verifie ta connexion puis reessaie."],
  [/ArgumentValidationError|validation/i, "Certaines informations du formulaire sont incorrectes."],
  [/Not authenticated|Unauthenticated|Authentification requise/i, "Ta session a expire. Reconnecte-toi pour continuer."],
  [/Unauthorized|Droits .* requis|forbidden/i, "Tu n'as pas les droits necessaires pour faire cette action."],
  [/RESEND_API_KEY|Resend|email.*failed|send.*email/i, "L'email n'a pas pu etre envoye pour le moment."],
  [/SITE_URL|CONVEX|VITE_|deployment|function/i, "Le service est temporairement indisponible."],
  [/duplicate|already exists|unique/i, "Cette information existe deja."],
  [/not found|introuvable/i, "L'element demande est introuvable ou n'est plus disponible."],
];

const technicalPatterns = [
  /\[CONVEX .+?\]/i,
  /Request ID:/i,
  /Server Error/i,
  /Uncaught Error:/i,
  /at .+\(.+:\d+:\d+\)/i,
  /Error: /i,
];

export function friendlyError(error: unknown, fallback = genericFallback) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const extracted = extractUsefulMessage(raw).trim();
  const candidate = extracted || fallback;

  for (const [pattern, message] of friendlyRules) {
    if (pattern.test(raw) || pattern.test(candidate)) {
      return message;
    }
  }

  if (isTechnical(candidate)) {
    return fallback;
  }

  return candidate;
}

function extractUsefulMessage(message: string) {
  const uncaught = message.match(/Uncaught Error:\s*([^\n]+)/i);
  if (uncaught?.[1]) {
    return uncaught[1];
  }

  return message
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.includes("[CONVEX") && !line.startsWith("at "))
    .at(-1) ?? message;
}

function isTechnical(message: string) {
  return technicalPatterns.some((pattern) => pattern.test(message));
}
