import Link from "next/link";
import { Table, Td, Th } from "@/components/ui/table";
import { StatusBadge } from "./StatusBadge";
import { formatCurrency } from "@/lib/utils";

export function TicketTable({ tickets }: { tickets: any[] }) {
  if (!tickets.length) {
    return (
      <div className="rounded-md border border-border bg-white p-6">
        <p className="font-medium">No tickets found.</p>
        <p className="mt-1 text-sm text-muted-foreground">Create a request from the intake page, or clear filters if you expected to see active tickets.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      <Table>
        <thead>
          <tr>
            <Th>Created</Th>
            <Th>User</Th>
            <Th>Phone</Th>
            <Th>City</Th>
            <Th>Budget</Th>
            <Th>BHK</Th>
            <Th>Status</Th>
            <Th>Counts</Th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id}>
              <Td>{new Date(ticket.created_at).toLocaleDateString()}</Td>
              <Td><Link className="font-medium text-primary" href={`/admin/tickets/${ticket.id}`}>{ticket.user_name || "Unnamed"}</Link></Td>
              <Td>{ticket.phone}</Td>
              <Td>{ticket.city}</Td>
              <Td>{formatCurrency(ticket.budget_max)}</Td>
              <Td>{ticket.bhk}</Td>
              <Td><StatusBadge value={ticket.status} /></Td>
              <Td className="text-muted-foreground">
                {ticket.candidate_count ?? 0} matches · {ticket.published_count ?? 0} published · {ticket.interested_count ?? 0} interested · {ticket.visit_count ?? 0} visits
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
