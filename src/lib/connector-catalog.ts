/** Tools an organization can connect on the wiring page. Safe for the browser. */
export type ConnectorSpec = {
  id: string;
  label: string;
  blurb: string;
  scopes?: string[];
};

export const CONNECTOR_CATALOG: ConnectorSpec[] = [
  {
    id: "slack",
    label: "Slack",
    blurb: "Approval requests and failure alerts in your own workspace.",
    scopes: [
      "chat:write",
      "chat:write.public",
      "channels:read",
      "channels:manage",
      "groups:read",
      "groups:write",
      "users:read",
      "users:read.email",
    ],
  },
  {
    id: "google_mail",
    label: "Gmail",
    blurb: "Send onboarding and approval emails from your own mailbox.",
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
  },
  {
    id: "microsoft_teams",
    label: "Microsoft Teams",
    blurb: "Post approvals and alerts into a Teams channel.",
    scopes: ["ChannelMessage.Send", "Team.ReadBasic.All", "offline_access"],
  },
  {
    id: "microsoft_outlook",
    label: "Microsoft Outlook",
    blurb: "Send notifications from your Outlook mailbox.",
    scopes: ["Mail.Send", "offline_access"],
  },
  {
    id: "google_calendar",
    label: "Google Calendar",
    blurb: "Book first-week onboarding sessions automatically.",
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  },
  {
    id: "google_sheets",
    label: "Google Sheets",
    blurb: "Mirror provisioning status into your own tracker sheet.",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  },
  {
    id: "google_drive",
    label: "Google Drive",
    blurb: "Share onboarding docs and folders with the new hire.",
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  },
  {
    id: "notion",
    label: "Notion",
    blurb: "Create the new hire's onboarding page from a template.",
  },
  {
    id: "linear",
    label: "Linear",
    blurb: "Open provisioning tickets for the owning team.",
    scopes: ["read", "write"],
  },
  {
    id: "hubspot",
    label: "HubSpot",
    blurb: "Give sales hires their CRM access records.",
    scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write"],
  },
  {
    id: "salesforce",
    label: "Salesforce",
    blurb: "Provision Salesforce records for revenue roles.",
  },
  {
    id: "microsoft_sharepoint",
    label: "SharePoint",
    blurb: "Grant access to team sites and policy documents.",
    scopes: ["Sites.ReadWrite.All", "offline_access"],
  },
];

export function connectorLabel(id: string): string {
  return CONNECTOR_CATALOG.find((c) => c.id === id)?.label ?? id;
}
