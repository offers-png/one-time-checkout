import { XCircle, Home } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Cancel() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-md w-full shadow-lg">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-cancel-title">
              Payment Cancelled
            </h1>
            <p className="text-muted-foreground">
              Your payment was cancelled. No charges have been made to your account.
            </p>
          </div>

          <Button asChild className="w-full" data-testid="button-go-home">
            <Link href="/">
              <Home className="w-4 h-4" />
              Return Home
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
