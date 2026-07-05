import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setAdminCookie, validateAdminLogin } from "@/lib/auth";

export default function AdminLoginPage() {
  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    if (validateAdminLogin(email, password)) {
      setAdminCookie();
      redirect("/admin");
    }
    redirect("/admin/login?error=1");
  }

  return (
    <main className="container-shell grid min-h-screen place-items-center py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin login</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminLoginForm action={login} />
        </CardContent>
      </Card>
    </main>
  );
}
