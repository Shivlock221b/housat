"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Banknote,
  BedDouble,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Gift,
  Home,
  Loader2,
  MapPin,
  MessageCircleOff,
  ShieldCheck,
  SlidersHorizontal,
  Sofa,
  UsersRound,
  X
} from "lucide-react";
import { HousatLogo } from "@/components/HousatLogo";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

type Parsed = {
  city: string | null;
  preferredLocalities: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  bhk: string | null;
  propertyTypes: string[];
  furnishing: string | null;
  moveInDate: string | null;
  tenantType: string | null;
  brokeragePreference: string | null;
  parkingRequired: boolean | null;
  petsRequired: boolean | null;
  mustHaves: string[];
  niceToHaves: string[];
  dealBreakers: string[];
  subjectivePreferences: { preference: string; type: string; importance: string; evidenceNeeded?: string[] }[];
  missingFields: string[];
  clarifyingQuestions: string[];
  confidence: number;
};

type Message = {
  role: "assistant" | "user";
  content: string;
};

type ContactDetails = {
  userName: string;
  phone: string;
  visitAvailability: string;
};

type StructuredRequirementUpdate = {
  message: string;
  patch: Partial<Parsed>;
  clears: Array<keyof Parsed>;
};

type RequirementStep =
  | { kind: "choice"; key: keyof Parsed; label: string; icon: ReactNode; options: string[]; toUpdate: (option: string) => StructuredRequirementUpdate }
  | { kind: "multiChoice"; key: keyof Parsed; label: string; icon: ReactNode; options: string[]; toUpdate: (options: string[]) => StructuredRequirementUpdate }
  | { kind: "text"; key: keyof Parsed; label: string; icon: ReactNode; placeholder: string; toUpdate: (value: string) => StructuredRequirementUpdate }
  | { kind: "budget" }
  | { kind: "date" }
  | { kind: "groqText"; key: "dealBreakers" | "notes"; label: string; helper: string };

type FollowUpState = {
  dealBreakers: boolean;
  notes: boolean;
};

type ContactStep = "name" | "whatsapp" | "availability" | null;

type ReviewState = "pending" | "reviewing";

const defaultPrompt =
  "Looking for a 2BHK in Gurgaon near Cyber City under 55k, semi furnished, good sunlight, family-friendly, parking needed, move-in by August 1.";
const quickChips = ["parking", "good sunlight", "attached bathrooms", "near metro", "no brokerage", "family-friendly", "bachelor-friendly", "balcony", "gated society"];
const loadingStates = ["Thinking through your brief", "Gathering search signals", "Formulating filters", "Checking what is missing"];
const propertyTypeOptions = [
  "Independent / Builder floors",
  "Individual house / Villa",
  "Flats / Apartments",
  "Duplex"
];

function list(value?: string[] | null) {
  return value?.length ? value.join(", ") : "Not specified";
}

function formatBudget(parsed: Parsed) {
  if (parsed.budgetMax) return `Up to ${formatCurrency(parsed.budgetMax)}`;
  return "Not specified";
}

function getMissingSearchFields(parsed: Parsed | null) {
  if (!parsed) return [];
  return [
    !parsed.city && "city",
    !parsed.budgetMax && "budget maximum",
    !parsed.bhk && "BHK",
    !parsed.propertyTypes?.length && "property type",
    !parsed.preferredLocalities?.length && "preferred localities"
  ].filter(Boolean) as string[];
}

function parseBudgetInput(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[₹,\s]/g, "");
  const multiplier = normalized.endsWith("k") ? 1000 : normalized.endsWith("l") || normalized.endsWith("lac") || normalized.endsWith("lakh") ? 100000 : 1;
  const numeric = Number(normalized.replace(/k|lac|lakh|l/g, ""));
  return Number.isFinite(numeric) ? Math.round(numeric * multiplier) : null;
}

function splitList(value: string) {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function removeMissingFields(missingFields: string[], clears: Array<keyof Parsed>) {
  const aliases: Partial<Record<keyof Parsed, string[]>> = {
    city: ["city"],
    preferredLocalities: ["locality", "localities", "preferred"],
    budgetMax: ["budget"],
    bhk: ["bhk"],
    propertyTypes: ["property type", "property"],
    furnishing: ["furnishing", "furnished"],
    moveInDate: ["move", "date"],
    tenantType: ["tenant"],
    brokeragePreference: ["brokerage"],
    parkingRequired: ["parking"],
    petsRequired: ["pet"]
  };
  const needles = clears.flatMap((key) => aliases[key] ?? [String(key).toLowerCase()]);
  return missingFields.filter((field) => !needles.some((needle) => field.toLowerCase().includes(needle)));
}

function getNextRequirementStep(parsed: Parsed | null, followUps: FollowUpState): RequirementStep | null {
  if (!parsed) return null;
  if (!parsed.city) {
    return {
      kind: "text",
      key: "city",
      label: "Which city should I search in?",
      icon: <MapPin className="h-4 w-4" />,
      placeholder: "Gurgaon",
      toUpdate: (value) => ({ message: `City: ${value}`, patch: { city: value }, clears: ["city"] })
    };
  }
  if (!parsed.preferredLocalities?.length) {
    return {
      kind: "text",
      key: "preferredLocalities",
      label: "Any preferred localities?",
      icon: <MapPin className="h-4 w-4" />,
      placeholder: "Sector 52, Cyber City",
      toUpdate: (value) => ({
        message: `Preferred localities: ${value}`,
        patch: { preferredLocalities: splitList(value) },
        clears: ["preferredLocalities"]
      })
    };
  }
  if (!parsed.budgetMax) return { kind: "budget" };
  if (!parsed.bhk) {
    return {
      kind: "choice",
      key: "bhk",
      label: "What size home should I look for?",
      icon: <BedDouble className="h-4 w-4" />,
      options: ["Studio", "1BHK", "2BHK", "3BHK", "4BHK", "5BHK+"],
      toUpdate: (option) => ({ message: `BHK: ${option}`, patch: { bhk: option }, clears: ["bhk"] })
    };
  }
  if (!parsed.propertyTypes?.length) {
    return {
      kind: "multiChoice",
      key: "propertyTypes",
      label: "Which property types should I include?",
      icon: <Home className="h-4 w-4" />,
      options: propertyTypeOptions,
      toUpdate: (options) => ({
        message: `Property types: ${options.join(", ")}`,
        patch: { propertyTypes: options },
        clears: ["propertyTypes"]
      })
    };
  }
  if (!parsed.tenantType) {
    return {
      kind: "choice",
      key: "tenantType",
      label: "Who will be staying?",
      icon: <UsersRound className="h-4 w-4" />,
      options: ["Family", "Bachelor", "Couple", "Company lease", "Flexible"],
      toUpdate: (option) => ({ message: `Tenant type: ${option}`, patch: { tenantType: option }, clears: ["tenantType"] })
    };
  }
  if (!parsed.furnishing) {
    return {
      kind: "choice",
      key: "furnishing",
      label: "What furnishing level works for you?",
      icon: <Sofa className="h-4 w-4" />,
      options: ["Fully furnished", "Semi furnished", "Unfurnished", "Flexible"],
      toUpdate: (option) => ({ message: `Furnishing: ${option}`, patch: { furnishing: option }, clears: ["furnishing"] })
    };
  }
  if (!parsed.brokeragePreference) {
    return {
      kind: "choice",
      key: "brokeragePreference",
      label: "What is your brokerage preference?",
      icon: <CircleDollarSign className="h-4 w-4" />,
      options: ["No brokerage", "Brokerage okay", "Prefer low brokerage", "Flexible"],
      toUpdate: (option) => ({ message: `Brokerage: ${option}`, patch: { brokeragePreference: option }, clears: ["brokeragePreference"] })
    };
  }
  if (parsed.parkingRequired === null) {
    return {
      kind: "choice",
      key: "parkingRequired",
      label: "Do you need parking?",
      icon: <Home className="h-4 w-4" />,
      options: ["Parking required", "Parking not needed", "Flexible"],
      toUpdate: (option) => ({
        message: `Parking: ${option}`,
        patch: { parkingRequired: option === "Parking required" },
        clears: ["parkingRequired"]
      })
    };
  }
  if (parsed.petsRequired === null) {
    return {
      kind: "choice",
      key: "petsRequired",
      label: "Do you need the home to be pet friendly?",
      icon: <ShieldCheck className="h-4 w-4" />,
      options: ["Pet friendly needed", "No pets", "Flexible"],
      toUpdate: (option) => ({
        message: `Pets: ${option}`,
        patch: { petsRequired: option === "Pet friendly needed" },
        clears: ["petsRequired"]
      })
    };
  }
  if (!parsed.moveInDate) return { kind: "date" };
  if (!followUps.dealBreakers) {
    return {
      kind: "groqText",
      key: "dealBreakers",
      label: "Any deal breakers I should avoid?",
      helper: "Examples: no ground floor, no old construction, no owner living in same building, no dark rooms."
    };
  }
  if (!followUps.notes) {
    return {
      kind: "groqText",
      key: "notes",
      label: "Any notes I should keep in mind?",
      helper: "I will treat these as useful context and nice-to-haves, not strict filters."
    };
  }
  return null;
}

function getContactStep(contact: ContactDetails): ContactStep {
  if (!contact.userName.trim()) return "name";
  if (!contact.phone.trim()) return "whatsapp";
  if (!contact.visitAvailability.trim()) return "availability";
  return null;
}

function getRequirementStepId(step: RequirementStep | null) {
  if (!step) return "";
  if (step.kind === "budget") return "requirement:budgetMax";
  if (step.kind === "date") return "requirement:moveInDate";
  return `requirement:${String(step.key)}`;
}

function getRequirementPrompt(step: RequirementStep) {
  if (step.kind === "budget") return "What is the maximum monthly budget you want me to use?";
  if (step.kind === "date") return "When are you planning to move in?";
  if (step.kind === "groqText") return `${step.label}\n${step.helper}`;
  return step.label;
}

function getContactPrompt(step: Exclude<ContactStep, null>) {
  if (step === "name") return "What is your name?";
  if (step === "whatsapp") return "What WhatsApp number should we use? We will only use it to contact you about your shortlist and visit coordination. We will not share it with anyone else.";
  return "When are you usually available for visits?";
}

function getComposerPlaceholder(activeRequirementStep: RequirementStep | null, activeContactStep: ContactStep, parsed: Parsed | null) {
  if (activeContactStep === "name") return "Type your name...";
  if (activeContactStep === "whatsapp") return "Type your WhatsApp number...";
  if (activeContactStep === "availability") return "Type your visit availability...";
  if (activeRequirementStep?.kind === "groqText") return activeRequirementStep.key === "dealBreakers" ? "Type your deal breakers..." : "Type any notes...";
  if (activeRequirementStep?.kind === "text" && activeRequirementStep.key === "city") return "Type the city...";
  if (parsed) return "Refine your search...";
  return "Describe your ideal rental home...";
}

function getComposerHelper(activeRequirementStep: RequirementStep | null, activeContactStep: ContactStep, readyForSummary: boolean, parsed: Parsed | null) {
  if (activeContactStep === "whatsapp") return "Used only for Housat shortlist updates on WhatsApp. Never shared with brokers or third parties.";
  if (activeContactStep) return "Reply here and I will save it to your request.";
  if (activeRequirementStep?.kind === "groqText") return activeRequirementStep.key === "dealBreakers" ? "Example: no ground floor, no old construction" : "Example: prefer quiet lane, balcony, good ventilation";
  if (activeRequirementStep?.kind === "text" && activeRequirementStep.key === "city") return "Example: Gurgaon";
  if (readyForSummary) return "Tap any summary block to edit it, then start the search when ready.";
  if (parsed) return "Example: make budget 75k and add balcony";
  return "Example: 2BHK near Cyber City under 55k, good sunlight, parking needed";
}

export function RequirementPromptForm() {
  const [composer, setComposer] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi, I am Housat AI. What kind of rental home would feel right for you?"
    },
    {
      role: "assistant",
      content: "Share your location, budget, BHK, must-haves, and anything you care about. I turn it into a clear brief, gather matching homes, filter them against your needs, confirm details with brokers, and help schedule visits around your availability."
    }
    // {
    //   role: "assistant",
    //   content: "Start casually. For example: 2BHK near Cyber City under 55k, good sunlight, family-friendly, parking needed."
    // }
  ]);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [followUps, setFollowUps] = useState<FollowUpState>({ dealBreakers: false, notes: false });
  const [reviewState, setReviewState] = useState<ReviewState>("pending");
  const [profileOpen, setProfileOpen] = useState(false);
  const [contact, setContact] = useState({
    userName: "",
    phone: "",
    visitAvailability: ""
  });
  const promptedRequirementSteps = useRef(new Set<string>());
  const promptedContactSteps = useRef(new Set<string>());

  const missingSearchFields = useMemo(() => getMissingSearchFields(parsed), [parsed]);
  const activeRequirementStep = useMemo(() => getNextRequirementStep(parsed, followUps), [parsed, followUps]);
  const readyForContact = Boolean(parsed && !activeRequirementStep);
  const activeContactStep = readyForContact ? getContactStep(contact) : null;
  const readyForSummary = Boolean(readyForContact && !activeContactStep);
  const canCreate = Boolean(readyForSummary && parsed && !missingSearchFields.length);
  const composerDisabled = loading || (readyForSummary && reviewState !== "pending");
  const composerPlaceholder = getComposerPlaceholder(activeRequirementStep, activeContactStep, parsed);
  const composerHelper = getComposerHelper(activeRequirementStep, activeContactStep, readyForSummary, parsed);

  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return;
    }
    const timer = window.setInterval(() => {
      setLoadingStep((current) => (current + 1) % loadingStates.length);
    }, 1200);
    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    if (!activeRequirementStep) return;
    const stepId = getRequirementStepId(activeRequirementStep);
    if (!stepId || promptedRequirementSteps.current.has(stepId)) return;
    promptedRequirementSteps.current.add(stepId);
    setMessages((items) => [...items, { role: "assistant", content: getRequirementPrompt(activeRequirementStep) }]);
  }, [activeRequirementStep]);

  useEffect(() => {
    if (!activeContactStep) return;
    const stepId = `contact:${activeContactStep}`;
    if (promptedContactSteps.current.has(stepId)) return;
    promptedContactSteps.current.add(stepId);
    setMessages((items) => [...items, { role: "assistant", content: getContactPrompt(activeContactStep) }]);
  }, [activeContactStep]);

  useEffect(() => {
    if (!readyForSummary || reviewState !== "pending") return;
    setReviewState("reviewing");
  }, [readyForSummary, reviewState]);

  async function submitText(text: string, followUpKey?: keyof FollowUpState, displayText = text) {
    if (!text || loading) return;
    const hadParsedRequirement = Boolean(parsed);
    setComposer("");
    setMessages((items) => [...items, { role: "user", content: displayText }]);
    setLoading(true);

    const endpoint = parsed ? "/api/refine-requirements" : "/api/parse-requirements";
    const body = parsed ? { current: parsed, editPrompt: text } : { prompt: text };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      const message = data.error || "Could not understand the requirement.";
      setMessages((items) => [...items, { role: "assistant", content: message }]);
      return;
    }

    setParsed(data.parsed);
    if (followUpKey) {
      setFollowUps((current) => ({ ...current, [followUpKey]: true }));
    }
  }

  async function sendMessage() {
    const text = composer.trim();
    if (!text || loading) return;

    if (activeRequirementStep?.kind === "text" && activeRequirementStep.key === "city") {
      applyStructuredUpdate(activeRequirementStep.toUpdate(text), text);
      setComposer("");
      return;
    }

    if (activeRequirementStep?.kind === "groqText") {
      const label = activeRequirementStep.key === "dealBreakers" ? "Deal breakers" : "Notes";
      await submitText(`${label}: ${text}`, activeRequirementStep.key, text);
      return;
    }

    if (activeContactStep) {
      submitContactDetail(text, activeContactStep);
      return;
    }

    if (readyForSummary && reviewState === "reviewing") {
      setComposer("");
      setMessages((items) => [...items, { role: "assistant", content: "You can edit the brief by tapping a summary block. No Groq call needed for these final adjustments." }]);
      return;
    }

    await submitText(text);
  }

  function submitContactDetail(value: string, step: Exclude<ContactStep, null>) {
    if (!value || loading) return;
    setComposer("");
    setMessages((items) => [...items, { role: "user", content: value }]);
    setContact((current) => ({
      ...current,
      ...(step === "name" ? { userName: value } : {}),
      ...(step === "whatsapp" ? { phone: value } : {}),
      ...(step === "availability" ? { visitAvailability: value } : {})
    }));
  }

  function applyStructuredUpdate(update: StructuredRequirementUpdate, displayMessage = update.message) {
    if (!parsed || loading) return;
    setMessages((items) => [...items, { role: "user", content: displayMessage }]);
    setParsed((current) => {
      if (!current) return current;
      return {
        ...current,
        ...update.patch,
        missingFields: removeMissingFields(current.missingFields, update.clears),
        confidence: Math.max(current.confidence ?? 0.7, 0.82)
      };
    });
  }

  function applySummaryUpdate(patch: Partial<Parsed>, clears: Array<keyof Parsed>) {
    setParsed((current) => {
      if (!current) return current;
      return {
        ...current,
        ...patch,
        missingFields: removeMissingFields(current.missingFields, clears),
        confidence: Math.max(current.confidence ?? 0.7, 0.82)
      };
    });
    setReviewState("reviewing");
  }

  async function createTicket() {
    if (!parsed) return;
    setLoading(true);
    const originalPrompt = messages
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .join("\n");
    const response = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalPrompt,
        userName: contact.userName,
        phone: contact.phone,
        email: "",
        city: parsed.city,
        preferredLocalities: parsed.preferredLocalities,
        budgetMin: parsed.budgetMin,
        budgetMax: parsed.budgetMax,
        bhk: parsed.bhk,
        propertyTypes: parsed.propertyTypes,
        furnishing: parsed.furnishing,
        moveInDate: parsed.moveInDate,
        tenantType: parsed.tenantType,
        brokeragePreference: parsed.brokeragePreference,
        visitAvailability: contact.visitAvailability,
        parkingRequired: parsed.parkingRequired,
        petsRequired: parsed.petsRequired,
        mustHaves: parsed.mustHaves,
        niceToHaves: parsed.niceToHaves,
        dealBreakers: parsed.dealBreakers,
        notes: "",
        parsedRequirements: parsed,
        subjectivePreferences: parsed.subjectivePreferences,
        clarifyingQuestions: parsed.clarifyingQuestions,
        parseConfidence: parsed.confidence
      })
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessages((items) => [...items, { role: "assistant", content: data.error || "Could not create ticket" }]);
      return;
    }
    window.location.href = `/request/confirmation/${data.ticketId}`;
  }

  return (
    <div className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="flex min-h-[calc(100vh-48px)] min-w-0 flex-col gap-4">
        <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl bg-background/90 px-1 py-2 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <HousatLogo size="lg" />
            <div className="min-w-0">
              <h1 className="brand-wordmark truncate text-4xl leading-none text-primary sm:text-5xl">Housat AI</h1>
              <p className="flex items-center gap-2 text-sm text-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Rental concierge online
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="grid h-12 w-12 place-items-center rounded-full border border-primary/15 bg-card/85 text-primary shadow-[0_10px_22px_rgba(15,61,58,0.15)] backdrop-blur transition hover:bg-white lg:hidden"
              aria-label="Open search profile"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="chat-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-white/80 shadow-[0_28px_80px_rgba(15,61,58,0.16)] ring-1 ring-primary/10">
        <div className="chat-thread flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-8 sm:py-8">
            {messages.map((message, index) => (
              <MessageBubble key={`${message.role}-${index}`} message={message} />
            ))}
            {readyForSummary && parsed && reviewState !== "pending" ? (
              <div className="flex items-start gap-3">
                <AssistantAvatar />
                <div className="w-full max-w-[94%] rounded-[22px] rounded-tl-md border border-border/70 bg-card/95 p-4 text-sm text-foreground shadow-[0_16px_36px_rgba(15,61,58,0.08)]">
                  <SearchSummaryBubble parsed={parsed} missingSearchFields={missingSearchFields} onUpdate={applySummaryUpdate} />
                </div>
              </div>
            ) : null}
            {activeRequirementStep && activeRequirementStep.kind !== "groqText" && !(activeRequirementStep.kind === "text" && activeRequirementStep.key === "city") ? (
              <RequirementStepBubble
                step={activeRequirementStep}
                loading={loading}
                onStructuredUpdate={applyStructuredUpdate}
              />
            ) : null}
            {readyForSummary && !activeContactStep && parsed ? (
              <CreateRequestBubble loading={loading} canCreate={canCreate} onCreateTicket={createTicket} />
            ) : null}
            {loading ? (
              <div className="flex items-start gap-3">
                <AssistantAvatar />
                <div className="inline-flex items-center gap-2 rounded-[20px] rounded-tl-md border border-border/70 bg-card/95 px-4 py-3 text-sm text-muted-foreground shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {loadingStates[loadingStep]}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex gap-2 overflow-x-auto border-t border-border/70 bg-card/90 px-4 py-3 sm:px-6">
            {quickChips.map((chip) => (
              <button
                key={chip}
                type="button"
                className="shrink-0 rounded-full border border-primary/10 bg-white/78 px-4 py-2 text-xs font-semibold text-muted-foreground shadow-sm transition hover:border-primary/30 hover:bg-white hover:text-primary"
                onClick={() => setComposer((value) => `${value}${value.trim() ? ", " : ""}${chip}`)}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="shrink-0 border-t border-border/70 bg-card/92 px-3 py-2 shadow-[0_-16px_32px_rgba(15,61,58,0.08)] backdrop-blur sm:px-5 sm:py-4">
            <div className="rounded-[28px] border border-primary/15 bg-white/90 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_28px_rgba(15,61,58,0.08)]">
              <div className="flex items-end gap-2">
                <Textarea
                  value={composer}
                  onChange={(event) => setComposer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder={composerPlaceholder}
                  disabled={composerDisabled}
                  className="max-h-24 min-h-11 resize-none border-0 bg-transparent px-2 py-2.5 text-sm leading-5 shadow-none focus:ring-0"
                />
                <Button onClick={sendMessage} disabled={!composer.trim() || composerDisabled} size="sm" className="mb-1 h-9 w-9 shrink-0 rounded-full border-primary bg-primary px-0 shadow-[0_8px_18px_rgba(15,61,58,0.22)]">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                  <span className="sr-only">Send</span>
                </Button>
              </div>
              <p className="truncate px-2 pb-1 text-[11px] text-muted-foreground">
                {composerHelper}
              </p>
            </div>
          </div>
        </div>
      </div>
      </section>
      <SearchProfilePanel
        parsed={parsed}
        activeRequirementStep={activeRequirementStep}
        activeContactStep={activeContactStep}
        followUps={followUps}
        contact={contact}
        setComposer={setComposer}
        mobileOpen={profileOpen}
        onMobileClose={() => setProfileOpen(false)}
      />
    </div>
  );
}

function AssistantAvatar() {
  return (
    <HousatLogo size="sm" className="mt-1 shrink-0" />
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[86%] rounded-[20px] rounded-tr-md bg-muted px-4 py-3 text-sm leading-6 text-foreground shadow-[0_10px_24px_rgba(15,61,58,0.14)]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <AssistantAvatar />
      <div className="max-w-[86%] rounded-[20px] rounded-tl-md border border-border/70 bg-card/95 px-4 py-3 text-sm leading-6 text-foreground shadow-[0_16px_34px_rgba(15,61,58,0.08)]">
        {message.content}
      </div>
    </div>
  );
}

function getStepTitle(step: RequirementStep | null) {
  if (!step) return "";
  if (step.kind === "budget") return "Budget max";
  if (step.kind === "date") return "Move-in date";
  return step.label;
}

function getProfileProgress(parsed: Parsed | null) {
  const essentials = [
    Boolean(parsed?.preferredLocalities?.length || parsed?.city),
    Boolean(parsed?.budgetMax),
    Boolean(parsed?.bhk),
    Boolean(parsed?.propertyTypes?.length),
    Boolean(parsed?.furnishing),
    Boolean(parsed?.tenantType),
    Boolean(parsed?.moveInDate),
    parsed?.parkingRequired !== null && parsed?.parkingRequired !== undefined
  ];
  const complete = essentials.filter(Boolean).length;
  return { complete, total: essentials.length, ratio: complete / essentials.length };
}

function SearchProfilePanel(props: {
  parsed: Parsed | null;
  activeRequirementStep: RequirementStep | null;
  activeContactStep: ContactStep;
  followUps: FollowUpState;
  contact: ContactDetails;
  setComposer: (value: string) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const contentProps = {
    parsed: props.parsed,
    activeRequirementStep: props.activeRequirementStep,
    activeContactStep: props.activeContactStep,
    followUps: props.followUps,
    contact: props.contact,
    setComposer: props.setComposer
  };

  return (
    <>
      {props.mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-primary/35 backdrop-blur-sm"
            onClick={props.onMobileClose}
            aria-label="Close search profile"
          />
          <aside className="absolute right-0 top-0 h-full w-[min(92vw,390px)] overflow-y-auto border-l border-white/70 bg-card p-4 shadow-[0_24px_80px_rgba(15,61,58,0.24)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="brand-wordmark text-2xl text-primary">Search profile</h2>
              <button
                type="button"
                onClick={props.onMobileClose}
                className="grid h-9 w-9 place-items-center rounded-full border border-border bg-white/80 text-foreground shadow-sm"
                aria-label="Close search profile"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SearchProfileContent {...contentProps} showHeader={false} />
          </aside>
        </div>
      ) : null}
      <aside className="hidden min-h-0 lg:block">
        <div className="sticky top-6 max-h-[calc(100vh-48px)] overflow-y-auto rounded-[22px] border border-white/80 bg-card/88 p-4 shadow-[0_24px_70px_rgba(15,61,58,0.13)] ring-1 ring-primary/10 backdrop-blur">
          <SearchProfileContent {...contentProps} />
        </div>
      </aside>
    </>
  );
}

function SearchProfileContent(props: {
  parsed: Parsed | null;
  activeRequirementStep: RequirementStep | null;
  activeContactStep: ContactStep;
  followUps: FollowUpState;
  contact: ContactDetails;
  setComposer: (value: string) => void;
  showHeader?: boolean;
}) {
  const progress = getProfileProgress(props.parsed);
  const preferenceChips = [
    ...(props.parsed?.mustHaves ?? []),
    ...(props.parsed?.niceToHaves ?? [])
  ].filter(Boolean).slice(0, 8);
  const stillNeeded = [
    props.activeRequirementStep ? getStepTitle(props.activeRequirementStep) : null,
    props.activeContactStep === "name" ? "Name" : null,
    props.activeContactStep === "whatsapp" ? "WhatsApp number" : null,
    props.activeContactStep === "availability" ? "Visit availability" : null
  ].filter(Boolean) as string[];

  return (
      <div className="space-y-4">
        {props.showHeader !== false ? (
          <div className="flex items-center justify-between gap-3">
            <h2 className="brand-wordmark text-2xl text-primary">Search profile</h2>
            <SlidersHorizontal className="h-5 w-5 text-foreground" />
          </div>
        ) : null}

        <section className="rounded-[18px] border border-border/70 bg-white/70 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">Search setup</p>
            <span className="text-sm font-medium">{progress.complete} of {progress.total} essentials</span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            {Array.from({ length: progress.total }).map((_, index) => (
              <div key={index} className="flex flex-1 items-center gap-2">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${index < progress.complete ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {index < progress.complete ? "✓" : ""}
                </span>
                {index < progress.total - 1 ? <span className={`h-0.5 flex-1 ${index < progress.complete - 1 ? "bg-primary" : "bg-border"}`} /> : null}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {progress.complete === progress.total ? "Essentials captured. A couple of preference checks may remain." : "Almost there. I will ask only what is still useful."}
          </p>
        </section>

        <section className="rounded-[18px] border border-border/70 bg-white/70 p-4 shadow-sm">
          <div className="divide-y divide-border">
            <ProfileRow icon={<MapPin />} label="Location" value={[...(props.parsed?.preferredLocalities ?? []), props.parsed?.city].filter(Boolean).join(", ") || "Pending"} onEdit={() => props.setComposer("Change location to ")} />
            <ProfileRow icon={<Banknote />} label="Budget" value={formatBudget(props.parsed ?? emptyParsed)} onEdit={() => props.setComposer("Change budget to ")} />
            <ProfileRow icon={<Home />} label="Home type" value={props.parsed?.bhk || "Pending"} onEdit={() => props.setComposer("Change BHK to ")} />
            <ProfileRow icon={<Home />} label="Property type" value={props.parsed?.propertyTypes?.join(", ") || "Pending"} onEdit={() => props.setComposer("Change property type to ")} />
            <ProfileRow icon={<Sofa />} label="Furnishing" value={props.parsed?.furnishing || "Pending"} onEdit={() => props.setComposer("Change furnishing to ")} />
            <ProfileRow icon={<UsersRound />} label="Tenant type" value={props.parsed?.tenantType || "Pending"} onEdit={() => props.setComposer("Change tenant type to ")} />
            <ProfileRow icon={<CalendarDays />} label="Move-in" value={props.parsed?.moveInDate || "Pending"} onEdit={() => props.setComposer("Change move-in date to ")} />
            <ProfileRow icon={<CircleDollarSign />} label="Brokerage" value={props.parsed?.brokeragePreference || "Pending"} onEdit={() => props.setComposer("Change brokerage preference to ")} />
          </div>
        </section>

        {stillNeeded.length ? (
          <section className="rounded-[18px] border border-border/70 bg-white/70 p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold">Still needed</p>
            <div className="space-y-2">
              {stillNeeded.map((item) => (
                <div key={item} className="flex items-center justify-between gap-3 rounded-full border border-accent/40 bg-amber-50/80 px-3 py-2 text-sm font-medium text-amber-800">
                  <span>{item}</span>
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-[18px] border border-border/70 bg-white/70 p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold">Preferences</p>
          {preferenceChips.length ? (
            <div className="flex flex-wrap gap-2">
              {preferenceChips.map((chip) => (
                <span key={chip} className="rounded-full border border-border bg-muted/35 px-3 py-1.5 text-xs font-medium text-foreground">{chip}</span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Preferences will appear here as we build the brief.</p>
          )}
        </section>

        <section className="rounded-[18px] border border-primary/15 bg-primary/5 p-4">
          <p className="mb-4 text-sm font-semibold text-primary">Why people choose Housat AI</p>
          <div className="space-y-4">
            <TrustRow icon={<Gift />} title="Free first search" text="No hidden charges" />
            <TrustRow icon={<BadgeCheck />} title="Human-reviewed shortlist" text="Quality over quantity" />
            <TrustRow icon={<MessageCircleOff />} title="No spam or endless calls" text="We respect your time" />
          </div>
        </section>

        <div className="relative h-24 overflow-hidden rounded-[18px] border border-primary/10 bg-white/70">
          <div className="absolute bottom-3 left-6 h-12 w-9 rounded-t-md border border-primary/20 bg-primary/5" />
          <div className="absolute bottom-3 left-20 h-16 w-12 rounded-t-md border border-primary/20 bg-primary/10" />
          <div className="absolute bottom-3 right-10 h-10 w-14 rounded-t-md border border-accent/20 bg-orange-50" />
          <div className="absolute bottom-3 left-0 right-0 h-px bg-primary/30" />
          <div className="absolute right-20 top-5 h-4 w-4 rounded-full bg-accent/40" />
        </div>
      </div>
  );
}

const emptyParsed: Parsed = {
  city: null,
  preferredLocalities: [],
  budgetMin: null,
  budgetMax: null,
  bhk: null,
  propertyTypes: [],
  furnishing: null,
  moveInDate: null,
  tenantType: null,
  brokeragePreference: null,
  parkingRequired: null,
  petsRequired: null,
  mustHaves: [],
  niceToHaves: [],
  dealBreakers: [],
  subjectivePreferences: [],
  missingFields: [],
  clarifyingQuestions: [],
  confidence: 0
};

function ProfileRow(props: { icon: ReactNode; label: string; value: string; onEdit: () => void }) {
  return (
    <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className="text-primary [&>svg]:h-5 [&>svg]:w-5">{props.icon}</span>
      <span>
        <span className="block text-sm font-semibold">{props.label}</span>
        <span className="block text-sm text-foreground">{props.value}</span>
      </span>
      <button type="button" onClick={props.onEdit} className="rounded-full border border-border bg-card/85 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/5">
        Edit
      </button>
    </div>
  );
}

function TrustRow(props: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-primary/25 bg-white/80 text-primary [&>svg]:h-4 [&>svg]:w-4">{props.icon}</span>
      <span>
        <span className="block text-sm font-semibold text-primary">{props.title}</span>
        <span className="block text-xs text-muted-foreground">{props.text}</span>
      </span>
    </div>
  );
}

function RequirementStepBubble({
  step,
  loading,
  onStructuredUpdate
}: {
  step: RequirementStep;
  loading: boolean;
  onStructuredUpdate: (update: StructuredRequirementUpdate) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <AssistantAvatar />
      <div className="w-full max-w-[94%] space-y-4 rounded-[20px] rounded-tl-md border border-primary/15 bg-card/95 p-4 text-sm text-foreground shadow-[0_16px_34px_rgba(15,61,58,0.08)]">
        {step.kind === "choice" ? (
          <ChoiceBlock icon={step.icon} label={step.label} options={step.options} loading={loading} onSelect={(option) => onStructuredUpdate(step.toUpdate(option))} />
        ) : null}
        {step.kind === "multiChoice" ? (
          <MultiChoiceBlock icon={step.icon} label={step.label} options={step.options} loading={loading} onSubmit={(options) => onStructuredUpdate(step.toUpdate(options))} />
        ) : null}
        {step.kind === "text" ? (
          <TextAnswerBlock icon={step.icon} label={step.label} placeholder={step.placeholder} loading={loading} onSubmit={(value) => onStructuredUpdate(step.toUpdate(value))} />
        ) : null}
        {step.kind === "budget" ? <BudgetAnswerBlock loading={loading} onStructuredUpdate={onStructuredUpdate} /> : null}
        {step.kind === "date" ? <DateAnswerBlock loading={loading} onStructuredUpdate={onStructuredUpdate} /> : null}
      </div>
    </div>
  );
}

function ChoiceBlock(props: {
  icon: ReactNode;
  label: string;
  options: string[];
  loading: boolean;
  onSelect: (option: string) => void;
}) {
  return (
    <div className="rounded-[18px] border border-border/70 bg-white/60 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="text-primary">{props.icon}</span>
        {props.label}
      </div>
      <div className="flex flex-wrap gap-2">
        {props.options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={props.loading}
            onClick={() => props.onSelect(option)}
            className="rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function MultiChoiceBlock(props: {
  icon: ReactNode;
  label: string;
  options: string[];
  loading: boolean;
  onSubmit: (options: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(option: string) {
    setSelected((current) => current.includes(option) ? current.filter((item) => item !== option) : [...current, option]);
  }

  return (
    <div className="rounded-[18px] border border-border/70 bg-white/60 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="text-primary">{props.icon}</span>
        {props.label}
      </div>
      <div className="flex flex-wrap gap-2">
        {props.options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              disabled={props.loading}
              onClick={() => toggle(option)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition disabled:pointer-events-none disabled:opacity-50 ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card/90 text-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="button" size="sm" disabled={!selected.length || props.loading} className="rounded-full" onClick={() => props.onSubmit(selected)}>
          Add selected
        </Button>
      </div>
    </div>
  );
}

function TextAnswerBlock(props: {
  icon: ReactNode;
  label: string;
  placeholder: string;
  type?: string;
  loading: boolean;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="rounded-[18px] border border-border/70 bg-white/60 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) return;
        props.onSubmit(trimmed);
        setValue("");
      }}
    >
      <label className="grid gap-2 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="text-primary">{props.icon}</span>
          {props.label}
        </span>
        <div className="flex gap-2">
          <Input value={value} type={props.type ?? "text"} onChange={(event) => setValue(event.target.value)} placeholder={props.placeholder} disabled={props.loading} className="h-10 rounded-full bg-card/90" />
          <Button type="submit" size="sm" disabled={!value.trim() || props.loading} className="shrink-0 rounded-full">
            Add
          </Button>
        </div>
      </label>
    </form>
  );
}

function BudgetAnswerBlock({ loading, onStructuredUpdate }: { loading: boolean; onStructuredUpdate: (update: StructuredRequirementUpdate) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="rounded-[18px] border border-border/70 bg-white/60 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const amount = value.trim();
        if (!amount) return;
        const parsedAmount = parseBudgetInput(amount);
        if (!parsedAmount) return;
        onStructuredUpdate({
          message: `Budget max: ${formatCurrency(parsedAmount)}`,
          patch: { budgetMax: parsedAmount },
          clears: ["budgetMax"]
        });
        setValue("");
      }}
    >
      <label className="grid gap-2 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-primary" />
          Budget max
        </span>
        <div className="flex gap-2">
          <Input value={value} inputMode="numeric" onChange={(event) => setValue(event.target.value)} placeholder="65000" disabled={loading} className="h-10 rounded-full bg-card/90" />
          <Button type="submit" size="sm" disabled={!value.trim() || loading} className="shrink-0 rounded-full">
            Add
          </Button>
        </div>
      </label>
    </form>
  );
}

function DateAnswerBlock({ loading, onStructuredUpdate }: { loading: boolean; onStructuredUpdate: (update: StructuredRequirementUpdate) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="rounded-[18px] border border-border/70 bg-white/60 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!value) return;
        onStructuredUpdate({
          message: `Move-in date: ${value}`,
          patch: { moveInDate: value },
          clears: ["moveInDate"]
        });
        setValue("");
      }}
    >
      <label className="grid gap-2 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Move-in date
        </span>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <Input value={value} type="date" onChange={(event) => setValue(event.target.value)} disabled={loading} className="h-10 min-w-0 rounded-full bg-card/90" />
          <Button type="submit" size="sm" disabled={!value || loading} className="shrink-0 rounded-full">
            Add
          </Button>
        </div>
      </label>
    </form>
  );
}

function CreateRequestBubble(props: { loading: boolean; canCreate: boolean; onCreateTicket: () => void | Promise<void> }) {
  return (
    <div className="flex items-start gap-3">
      <AssistantAvatar />
      <div className="space-y-3 rounded-[20px] rounded-tl-md border border-border/70 bg-card/95 p-4 text-sm text-foreground shadow-[0_16px_34px_rgba(15,61,58,0.08)]">
        <p className="font-medium">Everything I need is ready.</p>
        <p className="text-xs text-muted-foreground">I can now create your rental search request and start matching homes to this brief.</p>
        <Button onClick={props.onCreateTicket} disabled={!props.canCreate || props.loading} className="rounded-full">
          {props.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Start my search
        </Button>
      </div>
    </div>
  );
}

type SummaryField =
  | "city"
  | "preferredLocalities"
  | "budgetMax"
  | "bhk"
  | "propertyTypes"
  | "furnishing"
  | "moveInDate"
  | "tenantType"
  | "brokeragePreference"
  | "parkingRequired"
  | "petsRequired"
  | "mustHaves"
  | "niceToHaves"
  | "dealBreakers";

function SearchSummaryBubble({
  parsed,
  missingSearchFields,
  onUpdate
}: {
  parsed: Parsed;
  missingSearchFields: string[];
  onUpdate: (patch: Partial<Parsed>, clears: Array<keyof Parsed>) => void;
}) {
  const [editing, setEditing] = useState<SummaryField | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="brand-wordmark text-xl text-primary">Your rental brief</p>
        <span className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
          Tap a field to edit
        </span>
      </div>
      {missingSearchFields.length ? (
        <div className="rounded-[16px] border border-amber-200 bg-amber-50/80 p-3 text-amber-800">
          Add these to sharpen the search: {missingSearchFields.join(", ")}
        </div>
      ) : (
        <div className="rounded-[16px] border border-primary/20 bg-primary/10 p-3 text-primary">
          This is ready to turn into a search request.
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <EditableDetail field="city" label="City" value={parsed.city || ""} editing={editing} setEditing={setEditing} onSave={(value) => onUpdate({ city: value }, ["city"])} />
        <EditableDetail field="preferredLocalities" label="Localities" value={list(parsed.preferredLocalities)} editing={editing} setEditing={setEditing} multiline onSave={(value) => onUpdate({ preferredLocalities: splitList(value) }, ["preferredLocalities"])} />
        <EditableDetail field="budgetMax" label="Budget" value={formatBudget(parsed)} editValue={parsed.budgetMax ? String(parsed.budgetMax) : ""} editing={editing} setEditing={setEditing} inputMode="numeric" onSave={(value) => {
          const budget = parseBudgetInput(value);
          if (!budget) return "Enter a valid budget amount.";
          onUpdate({ budgetMax: budget }, ["budgetMax"]);
        }} />
        <EditableDetail field="bhk" label="BHK" value={parsed.bhk || ""} editing={editing} setEditing={setEditing} options={["Studio", "1BHK", "2BHK", "3BHK", "4BHK", "5BHK+"]} onSave={(value) => onUpdate({ bhk: value }, ["bhk"])} />
        <EditableDetail field="propertyTypes" label="Property type" value={list(parsed.propertyTypes)} editing={editing} setEditing={setEditing} multiOptions={propertyTypeOptions} onSave={(value) => onUpdate({ propertyTypes: splitList(value) }, ["propertyTypes"])} />
        <EditableDetail field="furnishing" label="Furnishing" value={parsed.furnishing || ""} editing={editing} setEditing={setEditing} options={["Fully furnished", "Semi furnished", "Unfurnished", "Flexible"]} onSave={(value) => onUpdate({ furnishing: value }, ["furnishing"])} />
        <EditableDetail field="moveInDate" label="Move-in" value={parsed.moveInDate || ""} editing={editing} setEditing={setEditing} type="date" onSave={(value) => onUpdate({ moveInDate: value }, ["moveInDate"])} />
        <EditableDetail field="tenantType" label="Tenant" value={parsed.tenantType || ""} editing={editing} setEditing={setEditing} options={["Family", "Bachelor", "Couple", "Company lease", "Flexible"]} onSave={(value) => onUpdate({ tenantType: value }, ["tenantType"])} />
        <EditableDetail field="brokeragePreference" label="Brokerage" value={parsed.brokeragePreference || ""} editing={editing} setEditing={setEditing} options={["No brokerage", "Brokerage okay", "Prefer low brokerage", "Flexible"]} onSave={(value) => onUpdate({ brokeragePreference: value }, ["brokeragePreference"])} />
        <EditableDetail field="parkingRequired" label="Parking" value={parsed.parkingRequired ? "Required" : "Not needed / flexible"} editing={editing} setEditing={setEditing} options={["Required", "Not needed / flexible"]} onSave={(value) => onUpdate({ parkingRequired: value === "Required" }, ["parkingRequired"])} />
        <EditableDetail field="petsRequired" label="Pets" value={parsed.petsRequired ? "Pet friendly needed" : "No pets / flexible"} editing={editing} setEditing={setEditing} options={["Pet friendly needed", "No pets / flexible"]} onSave={(value) => onUpdate({ petsRequired: value === "Pet friendly needed" }, ["petsRequired"])} />
        <EditableDetail field="mustHaves" label="Must-haves" value={list(parsed.mustHaves)} editing={editing} setEditing={setEditing} multiline wide allowEmpty onSave={(value) => onUpdate({ mustHaves: splitList(value) }, ["mustHaves"])} />
        <EditableDetail field="niceToHaves" label="Nice-to-haves" value={list(parsed.niceToHaves)} editing={editing} setEditing={setEditing} multiline wide allowEmpty onSave={(value) => onUpdate({ niceToHaves: splitList(value) }, ["niceToHaves"])} />
        <EditableDetail field="dealBreakers" label="Deal-breakers" value={list(parsed.dealBreakers)} editing={editing} setEditing={setEditing} multiline wide allowEmpty onSave={(value) => onUpdate({ dealBreakers: splitList(value) }, ["dealBreakers"])} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-border bg-muted/25 p-3">
        <p className="text-xs text-muted-foreground">
          Edit fields here directly. When everything looks right, use Start my search below.
        </p>
      </div>
    </div>
  );
}

function EditableDetail({
  field,
  label,
  value,
  editValue,
  editing,
  setEditing,
  onSave,
  options,
  multiOptions,
  type = "text",
  inputMode,
  multiline,
  wide,
  allowEmpty
}: {
  field: SummaryField;
  label: string;
  value: string;
  editValue?: string;
  editing: SummaryField | null;
  setEditing: (field: SummaryField | null) => void;
  onSave: (value: string) => void | string;
  options?: string[];
  multiOptions?: string[];
  type?: string;
  inputMode?: "numeric";
  multiline?: boolean;
  wide?: boolean;
  allowEmpty?: boolean;
}) {
  const isEditing = editing === field;
  const [draft, setDraft] = useState(value === "Not specified" ? "" : value);
  const [error, setError] = useState("");
  const selectedOptions = multiOptions ? splitList(draft) : [];

  useEffect(() => {
    if (isEditing) {
      setDraft(editValue ?? (value === "Not specified" ? "" : value));
      setError("");
    }
  }, [editValue, isEditing, value]);

  function save() {
    const trimmed = draft.trim();
    if (!trimmed && !allowEmpty) {
      setError("This field is required.");
      return;
    }
    const result = onSave(trimmed);
    if (typeof result === "string") {
      setError(result);
      return;
    }
    setEditing(null);
  }

  function toggleMultiOption(option: string) {
    const next = selectedOptions.includes(option)
      ? selectedOptions.filter((item) => item !== option)
      : [...selectedOptions, option];
    setDraft(next.join(", "));
  }

  return (
    <div className={`rounded-[16px] border border-border bg-white/55 p-3 transition hover:border-primary/25 ${wide ? "sm:col-span-2" : ""}`}>
      <button type="button" className="w-full text-left" onClick={() => setEditing(field)}>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{value || "Not specified"}</p>
      </button>
      {isEditing ? (
        <div className="mt-3 space-y-2">
          {multiOptions ? (
            <div className="flex flex-wrap gap-2">
              {multiOptions.map((option) => {
                const isSelected = selectedOptions.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleMultiOption(option)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card/90 text-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          ) : options ? (
            <select value={draft} onChange={(event) => setDraft(event.target.value)} className="h-10 w-full rounded-full border border-border bg-card/90 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15">
              <option value="" disabled>Select {label.toLowerCase()}</option>
              {options.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          ) : multiline ? (
            <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="min-h-24 resize-none rounded-[16px] bg-card/90" />
          ) : (
            <Input value={draft} type={type} inputMode={inputMode} onChange={(event) => setDraft(event.target.value)} className="h-10 rounded-full bg-card/90" />
          )}
          {error ? <p className="text-xs text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="button" size="sm" className="rounded-full" onClick={save}>Save</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
