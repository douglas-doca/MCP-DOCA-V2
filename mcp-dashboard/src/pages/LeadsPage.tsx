import React from "react";
import LeadsInbox from "../components/LeadsInbox";

export default function LeadsPage(props: any) {
  const leads = Array.isArray(props?.leads) ? props.leads : [];
  const conversations = Array.isArray(props?.conversations)
    ? props.conversations
    : [];

  return (
    <div className="space-y-6">
      <LeadsInbox
        leads={leads}
        conversations={conversations}
        onOpenConversation={props?.onOpenConversation}
        onSendFollowUp={props?.onSendFollowUp}
        onMarkAsWon={props?.onMarkAsWon}
      />
    </div>
  );
}
