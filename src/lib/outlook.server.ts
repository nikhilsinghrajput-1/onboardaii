import { gatewayCall, type ToolStepResult } from "./gateway.server";

/** Sends one mail from the Outlook mailbox. Used when Gmail is not connected. */
export async function sendOutlookMail(
  to: string,
  subject: string,
  html: string,
): Promise<ToolStepResult> {
  const res = await gatewayCall("microsoft_outlook", "/v1.0/me/sendMail", {
    method: "POST",
    body: {
      message: {
        subject,
        body: { contentType: "HTML", content: html },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    },
  });
  if (!res.ok) return { ok: false, error: res.error, detail: res.raw.slice(0, 400) };
  return { ok: true, detail: `Welcome mail sent to ${to} from Outlook` };
}
