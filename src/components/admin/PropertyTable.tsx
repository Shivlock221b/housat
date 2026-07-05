import { Table, Td, Th } from "@/components/ui/table";

export function PropertyTable({ properties }: { properties: any[] }) {
  return (
    <Table>
      <thead><tr><Th>Title</Th><Th>Locality</Th><Th>Rent</Th><Th>Status</Th></tr></thead>
      <tbody>{properties.map((p) => <tr key={p.id}><Td>{p.title}</Td><Td>{p.locality}</Td><Td>{p.rent}</Td><Td>{p.availability_status}</Td></tr>)}</tbody>
    </Table>
  );
}
