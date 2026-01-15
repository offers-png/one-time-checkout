import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DollarSign, Copy, CheckCircle, AlertCircle, Loader2, Link as LinkIcon, Zap } from "lucide-react";
import { SiStripe } from "react-icons/si";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { createLinkSchema, type CreateLinkInput, type CreateLinkResponse } from "@shared/schema";

export default function Home() {
  const { toast } = useToast();
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<CreateLinkInput>({
    resolver: zodResolver(createLinkSchema),
    defaultValues: {
      price: undefined,
    },
  });

  const createLinkMutation = useMutation({
    mutationFn: async (data: CreateLinkInput) => {
      const response = await apiRequest("POST", "/api/create-link", data);
      return response.json() as Promise<CreateLinkResponse>;
    },
    onSuccess: (data) => {
      setGeneratedUrl(data.private_url);
      setCopied(false);
      toast({
        title: "Payment link created",
        description: "Your secure payment link is ready to share.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create payment link. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateLinkInput) => {
    createLinkMutation.mutate(data);
  };

  const copyToClipboard = async () => {
    if (generatedUrl) {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      toast({
        title: "Copied",
        description: "Link copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNewLink = () => {
    setGeneratedUrl(null);
    form.reset();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 border-b border-border px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <LinkIcon className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">PayLink</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Zap className="w-4 h-4" />
          <span>Secure payments</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              Payment Link Generator
            </h1>
            <p className="text-muted-foreground text-lg">
              Create secure, single-use Stripe payment links instantly
            </p>
          </div>

          <Card className="shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Create Payment Link
              </CardTitle>
              <CardDescription>
                Enter the amount and generate a private payment link that expires in 1 hour
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!generatedUrl ? (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Amount (USD)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                                $
                              </div>
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="0.00"
                                className="pl-8 h-12 text-lg font-mono"
                                data-testid="input-price"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                value={field.value ?? ""}
                              />
                            </div>
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Enter amount in USD. Minimum $0.01, maximum $999,999
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-medium"
                      disabled={createLinkMutation.isPending}
                      data-testid="button-generate"
                    >
                      {createLinkMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating payment link...
                        </>
                      ) : (
                        <>
                          <LinkIcon className="w-4 h-4" />
                          Generate Payment Link
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Link generated successfully</span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Your payment link
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Input
                          readOnly
                          value={generatedUrl}
                          className="h-12 font-mono text-sm pr-24 bg-muted/50"
                          data-testid="text-generated-url"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2"
                          onClick={copyToClipboard}
                          data-testid="button-copy"
                        >
                          {copied ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This link is single-use and expires in 1 hour
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 h-12"
                      onClick={handleNewLink}
                      data-testid="button-new-link"
                    >
                      Create Another Link
                    </Button>
                    <Button
                      className="flex-1 h-12"
                      onClick={copyToClipboard}
                      data-testid="button-copy-main"
                    >
                      {copied ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy Link
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="bg-muted/30 rounded-lg p-4 border border-border">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">How it works</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>1. Enter the payment amount in USD</li>
                  <li>2. Click generate to create a secure Stripe checkout link</li>
                  <li>3. Share the private link with your customer</li>
                  <li>4. Link expires after 1 hour or first use</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-8 border-t border-border">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>Powered by</span>
          <SiStripe className="w-10 h-auto text-foreground" />
        </div>
      </footer>
    </div>
  );
}
