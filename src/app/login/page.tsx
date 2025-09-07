"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";

const LSK_AUTH = "mob_auth_status";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [userId, setUserId] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    // If user is already logged in, redirect to dashboard
    if (localStorage.getItem(LSK_AUTH) === "true") {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate network delay
    setTimeout(() => {
      if (userId === "masterofbrands" && password === "admin@123") {
        localStorage.setItem(LSK_AUTH, "true");
        toast({
          title: "Login Successful",
          description: "Redirecting to your dashboard...",
        });
        router.replace("/dashboard");
      } else {
        toast({
          title: "Login Failed",
          description: "Invalid user ID or password.",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    }, 500);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <Card className="w-full max-w-sm mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
            <Shield className="h-8 w-8" />
          </div>
          <CardTitle>BrandTracker Pro</CardTitle>
          <CardDescription>Please log in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                type="text"
                placeholder="masterofbrands"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
