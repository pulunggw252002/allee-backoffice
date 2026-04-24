import { redirect } from "next/navigation";

/**
 * Integration hub landing. Right now the only integration is the ojol
 * marketplace sync; redirect there so the sidebar "Integrasi" link has a
 * concrete destination. Add more sub-routes here later (WhatsApp, payment
 * gateway, etc.) when they land.
 */
export default function IntegrationsIndex() {
  redirect("/integrations/ojol");
}
