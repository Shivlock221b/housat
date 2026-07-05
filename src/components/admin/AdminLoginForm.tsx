"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminLoginForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [pending, setPending] = useState(false);
  return (
    <form
      action={async (formData) => {
        setPending(true);
        await action(formData);
        setPending(false);
      }}
      className="grid gap-4"
    >
      <label className="grid gap-1 text-sm font-medium">
        Email
        <Input name="email" type="email" required />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Password
        <Input name="password" type="password" required />
      </label>
      <Button disabled={pending}><LogIn className="h-4 w-4" /> Sign in</Button>
    </form>
  );
}
