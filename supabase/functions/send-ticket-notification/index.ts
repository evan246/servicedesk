import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "IT Desk <noreply@resend.dev>";

interface RequestBody {
  ticketId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { ticketId } = (await req.json()) as RequestBody;
    if (!ticketId) {
      return new Response(JSON.stringify({ error: "Missing ticketId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use the service role key to read the ticket (bypasses RLS).
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase server environment variables.");
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: ticket, error } = await supabase
      .from("tickets")
      .select("ticket_number, requester_name, requester_email, department, category, urgency, status, resolved_at")
      .eq("id", ticketId)
      .maybeSingle();

    if (error) throw error;
    if (!ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ticket.requester_email) {
      return new Response(JSON.stringify({ skipped: true, reason: "no requester email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured. Add it in Bolt database Secrets.");
    }

    const subject =
      ticket.status === "resolved"
        ? `Your IT request ${ticket.ticket_number} has been resolved`
        : `Update on your IT request ${ticket.ticket_number}`;

    const statusLabel =
      ticket.status === "in_progress"
        ? "In Progress"
        : ticket.status === "resolved"
          ? "Resolved"
          : "Open";

    const html = buildEmailHtml({
      ticketNumber: ticket.ticket_number,
      requesterName: ticket.requester_name,
      department: ticket.department,
      category: ticket.category,
      urgency: ticket.urgency,
      statusLabel,
      resolved: ticket.status === "resolved",
    });

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: ticket.requester_email,
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const text = await resendRes.text();
      throw new Error(`Resend API error (${resendRes.status}): ${text}`);
    }

    return new Response(JSON.stringify({ sent: true, to: ticket.requester_email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-ticket-notification error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildEmailHtml(p: {
  ticketNumber: string;
  requesterName: string;
  department: string;
  category: string;
  urgency: string;
  statusLabel: string;
  resolved: boolean;
}): string {
  const heading = p.resolved
    ? `Your IT request has been resolved`
    : `There's an update on your IT request`;
  const intro = p.resolved
    ? `Hi ${p.requesterName}, the IT team has marked your request as resolved. You can review the details below.`
    : `Hi ${p.requesterName}, the IT team has updated the status of your request.`;

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#fbf9f4;font-family:Inter,system-ui,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #ede4d3;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:24px 32px;background:#2f6b65;">
            <span style="font-size:18px;font-weight:600;color:#fbf9f4;font-family:Georgia,serif;">School IT Desk</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 8px;font-size:22px;color:#1c1b19;font-family:Georgia,serif;">${heading}</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3d3a35;">${intro}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fbf9f4;border:1px solid #ede4d3;border-radius:8px;padding:20px;">
              <tr><td style="padding:6px 0;font-size:14px;color:#3d3a35;"><strong>Ticket:</strong> ${p.ticketNumber}</td></tr>
              <tr><td style="padding:6px 0;font-size:14px;color:#3d3a35;"><strong>Department:</strong> ${p.department}</td></tr>
              <tr><td style="padding:6px 0;font-size:14px;color:#3d3a35;"><strong>Category:</strong> ${p.category}</td></tr>
              <tr><td style="padding:6px 0;font-size:14px;color:#3d3a35;"><strong>Urgency:</strong> ${p.urgency}</td></tr>
              <tr><td style="padding:6px 0;font-size:14px;color:#3d3a35;"><strong>Status:</strong> ${p.statusLabel}</td></tr>
            </table>
            <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#8a8a86;">
              You don't need to reply to this email. If you have questions, add a comment on your ticket in the School IT Desk app.
            </p>
          </td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#8a8a86;">School IT Service Desk · Automated notification</p>
      </td></tr>
    </table>
  </body>
</html>`;
}
