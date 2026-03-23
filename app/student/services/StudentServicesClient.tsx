"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Briefcase,
  CalendarDays,
  Home,
  Plane,
  MapPin,
  Wifi,
  CookingPot,
  Bed,
  Lock,
  Receipt,
  QrCode,
} from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import { COUNTRIES } from "@/lib/countries";

type Listing = {
  id: string;
  type: "ACCOMMODATION" | "JOB_INTERNSHIP" | "AIRPORT_PICKUP" | "OTHER";
  title: string;
  description: string | null;
  city: string;
  country: string;
  price: number | null;
  currency: string;
  availableFrom: string | null;
  amenities: string[];
  images: string[];
  isFullyFurnished: boolean;
  isBillsIncluded: boolean;
  jobTitle: string | null;
  jobType: string | null;
  jobSector: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  hoursPerWeek: number | null;
  isRemote: boolean;
  applicationDeadline: string | null;
};

type StudentEvent = {
  invitationId: string;
  rsvpStatus: "PENDING" | "ATTENDING" | "NOT_ATTENDING" | "MAYBE";
  event: {
    id: string;
    title: string;
    eventDate: string;
    eventTime: string;
    location: string;
    isOnline: boolean;
    targetCountry: string;
  };
};

type ApplicationRow = {
  id: string;
  listing: string;
  providerType: string;
  status: string;
  referralCode: string;
  dateApplied: string;
};

type ReferralRow = {
  id: string;
  referralCode: string;
  status: "SENT" | "CLICKED" | "ENQUIRED" | "SHORTLISTED" | "PLACED" | "REJECTED" | "EXPIRED";
  studentConfirmed: boolean;
  studentConfirmedAt: string | null;
  followUpCount: number;
  followUpSentAt: string | null;
  createdAt: string;
  listing: {
    id: string;
    title: string;
    city: string;
    country: string;
  };
  provider: {
    id: string;
    name: string;
  };
};

type BookingRow = {
  id: string;
  bookingReference: string;
  airport: string;
  arrivalDate: string;
  arrivalTime: string;
  flightNumber: string;
  status: string;
  paymentStatus: "PENDING" | "PROOF_UPLOADED" | "CONFIRMED" | "REJECTED" | "REFUNDED" | "CANCELLED" | null;
  rejectionReason: string | null;
  invoiceUrl: string | null;
};

type PricingRow = {
  id: string;
  airport: string | null;
  name: string;
  amount: number;
  currency: string;
};

type Props = {
  studentId: string;
  isVisaApproved: boolean;
  approvedCountries: string[];
  pricing: PricingRow[];
  bankDetails: {
    accountName: string;
    bankName: string;
    sortCode: string;
    accountNumber: string;
    iban: string;
  };
};

type UploadState = {
  fileName: string;
  url: string;
  previewUrl: string | null;
};

const airportsByCountry: Record<string, string[]> = {
  UK: ["Heathrow", "Gatwick", "Manchester", "Birmingham", "Edinburgh", "Bristol"],
  Canada: ["Toronto Pearson", "Vancouver", "Montreal", "Calgary"],
  Australia: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"],
  USA: ["JFK", "LAX", "Chicago O'Hare", "Miami"],
  Ireland: ["Dublin"],
  "New Zealand": ["Auckland", "Christchurch"],
};

const placeholderImage = "https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=80";

export default function StudentServicesClient({
  studentId,
  isVisaApproved,
  approvedCountries,
  pricing,
  bankDetails,
}: Props) {
  const [accommodation, setAccommodation] = useState<Listing[]>([]);
  const [jobs, setJobs] = useState<Listing[]>([]);
  const [events, setEvents] = useState<StudentEvent[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [activeSection, setActiveSection] = useState<"accommodation" | "jobs" | "pickup" | "events">("accommodation");
  const [activeBottomTab, setActiveBottomTab] = useState<"applications" | "referrals" | "bookings">("applications");

  const [accSearch, setAccSearch] = useState("");
  const [accCountry, setAccCountry] = useState("");
  const [accMaxPrice, setAccMaxPrice] = useState("");
  const [accFurnished, setAccFurnished] = useState(false);
  const [accBills, setAccBills] = useState(false);

  const [jobType, setJobType] = useState("ALL");
  const [jobSector, setJobSector] = useState("");
  const [jobCountry, setJobCountry] = useState("");
  const [jobRemote, setJobRemote] = useState(false);

  const [enquireListing, setEnquireListing] = useState<Listing | null>(null);
  const [submittingEnquiry, setSubmittingEnquiry] = useState(false);
  const [enquirySuccess, setEnquirySuccess] = useState<{ code: string } | null>(null);

  const [pickupStep, setPickupStep] = useState<1 | 2 | 3 | 4>(1);
  const [pickupSuccess, setPickupSuccess] = useState<{ reference: string; airport: string } | null>(null);
  const [ticketUpload, setTicketUpload] = useState<UploadState | null>(null);
  const [paymentProofUpload, setPaymentProofUpload] = useState<UploadState | null>(null);
  const [pickupSubmitting, setPickupSubmitting] = useState(false);

  const [pickupForm, setPickupForm] = useState({
    destinationCity: "",
    destinationCountry: approvedCountries[0] || "UK",
    airport: "",
    otherAirport: "",
    terminal: "",
    flightNumber: "",
    departureCountry: "",
    departureCity: "",
    departureDate: "",
    departureTime: "",
    arrivalDate: "",
    arrivalTime: "",
    passengerCount: 1,
    specialRequirements: "",
    paymentMethod: "BANK_TRANSFER" as "BANK_TRANSFER" | "IN_PERSON" | "ONLINE",
  });

  const selectedAirport = pickupForm.destinationCountry === "Other" ? pickupForm.otherAirport : pickupForm.airport;
  const selectedPricing = useMemo(() => {
    const key = selectedAirport.trim().toLowerCase();
    if (!key) return null;
    return pricing.find((item) => (item.airport || item.name).trim().toLowerCase() === key) || null;
  }, [pricing, selectedAirport]);

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [accRes, jobRes, eventsRes, appsRes, referralsRes, bookingsRes] = await Promise.all([
        fetch("/api/student/services/listings?type=ACCOMMODATION", { cache: "no-store" }),
        fetch("/api/student/services/listings?type=JOB_INTERNSHIP", { cache: "no-store" }),
        fetch("/api/student/events", { cache: "no-store" }),
        fetch("/api/student/services/applications", { cache: "no-store" }),
        fetch("/api/student/service-referrals", { cache: "no-store" }),
        fetch("/api/student/airport-pickup", { cache: "no-store" }),
      ]);

      const [accJson, jobJson, eventsJson, appsJson, referralsJson, bookingsJson] = await Promise.all([
        accRes.json(),
        jobRes.json(),
        eventsRes.json(),
        appsRes.json(),
        referralsRes.json(),
        bookingsRes.json(),
      ]);

      if (!accRes.ok) throw new Error(accJson.error || "Failed loading accommodation");
      if (!jobRes.ok) throw new Error(jobJson.error || "Failed loading jobs");
      if (!eventsRes.ok) throw new Error(eventsJson.error || "Failed loading events");
      if (!appsRes.ok) throw new Error(appsJson.error || "Failed loading applications");
      if (!referralsRes.ok) throw new Error(referralsJson.error || "Failed loading referrals");
      if (!bookingsRes.ok) throw new Error(bookingsJson.error || "Failed loading bookings");

      setAccommodation(accJson.data || []);
      setJobs(jobJson.data || []);
      setEvents(eventsJson.data || []);
      setApplications(appsJson.data || []);
      setReferrals(referralsJson.data || []);
      setBookings(bookingsJson.data || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load services");
    } finally {
      setLoading(false);
    }
  }

  const filteredAccommodation = useMemo(() => {
    const search = accSearch.trim().toLowerCase();
    return accommodation.filter((item) => {
      if (search && !(`${item.city} ${item.country}`.toLowerCase().includes(search))) return false;
      if (accCountry && item.country !== accCountry) return false;
      if (accMaxPrice && item.price != null && item.price > Number(accMaxPrice)) return false;
      if (accFurnished && !item.isFullyFurnished) return false;
      if (accBills && !item.isBillsIncluded) return false;
      return true;
    });
  }, [accommodation, accBills, accCountry, accFurnished, accMaxPrice, accSearch]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((item) => {
      if (jobType !== "ALL" && (item.jobType || "") !== jobType) return false;
      if (jobSector && !(item.jobSector || "").toLowerCase().includes(jobSector.toLowerCase())) return false;
      if (jobCountry && !item.country.toLowerCase().includes(jobCountry.toLowerCase())) return false;
      if (jobRemote && !item.isRemote) return false;
      return true;
    });
  }, [jobCountry, jobRemote, jobSector, jobType, jobs]);

  async function submitEnquiry() {
    if (!enquireListing) return;
    setSubmittingEnquiry(true);
    try {
      const referralCode = Math.random().toString(36).substr(2, 8).toUpperCase();
      const response = await fetch("/api/student/services/enquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: enquireListing.id, studentNote: "", referralCode }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to submit enquiry");
      setEnquireListing(null);
      setEnquirySuccess({ code: json.data.referralCode || referralCode });
      await loadAll();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit enquiry");
    } finally {
      setSubmittingEnquiry(false);
    }
  }

  async function uploadSingle(file: File) {
    const form = new FormData();
    form.append("files", file);
    form.append("preserveOriginal", "true");
    const response = await fetch("/api/upload", { method: "POST", body: form });
    const json = await response.json();
    if (!response.ok || !json.urls?.[0]) {
      throw new Error(json.error || "Upload failed");
    }
    return json.urls[0] as string;
  }

  async function onFileSelect(
    event: React.ChangeEvent<HTMLInputElement>,
    target: "ticket" | "paymentProof",
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(file.type)) {
      setError("Only PDF, JPG, PNG files are allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds 10MB limit.");
      return;
    }
    try {
      const url = await uploadSingle(file);
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      const payload = { fileName: file.name, url, previewUrl };
      if (target === "ticket") setTicketUpload(payload);
      if (target === "paymentProof") setPaymentProofUpload(payload);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    }
  }

  async function confirmBooking(event: FormEvent) {
    event.preventDefault();
    if (!ticketUpload) {
      setError("Flight ticket upload is required.");
      return;
    }
    if (pickupForm.paymentMethod === "BANK_TRANSFER" && !paymentProofUpload) {
      setError("Payment proof is required for bank transfer.");
      return;
    }
    setPickupSubmitting(true);
    try {
      const response = await fetch("/api/student/airport-pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          destinationCity: pickupForm.destinationCity,
          destinationCountry: pickupForm.destinationCountry,
          airport: selectedAirport,
          terminal: pickupForm.terminal || null,
          flightNumber: pickupForm.flightNumber,
          departureCountry: pickupForm.departureCountry,
          departureCity: pickupForm.departureCity,
          departureDate: pickupForm.departureDate,
          departureTime: pickupForm.departureTime,
          arrivalDate: pickupForm.arrivalDate,
          arrivalTime: pickupForm.arrivalTime,
          passengerCount: pickupForm.passengerCount,
          specialRequirements: pickupForm.specialRequirements || null,
          ticketConfirmationUrl: ticketUpload.url,
          ticketFileName: ticketUpload.fileName,
          paymentMethod: pickupForm.paymentMethod,
          paymentProofUrl: paymentProofUpload?.url || null,
          paymentProofName: paymentProofUpload?.fileName || null,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to create booking");
      setPickupSuccess({ reference: json.data.bookingReference, airport: selectedAirport });
      await loadAll();
    } catch (bookingError) {
      setError(bookingError instanceof Error ? bookingError.message : "Failed to create booking");
    } finally {
      setPickupSubmitting(false);
    }
  }

  async function rsvp(invitationId: string, status: "ATTENDING" | "NOT_ATTENDING") {
    const response = await fetch(`/api/events/rsvp/${invitationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error || "Failed to submit RSVP");
      return;
    }
    await loadAll();
  }

  async function confirmReferral(referralId: string, confirmed: boolean) {
    try {
      const response = await fetch("/api/student/service-referrals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralId, confirmed }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to update referral");
      await loadAll();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Failed to update referral");
    }
  }

  async function resubmitPayment(bookingId: string, file: File | null) {
    if (!file) return;
    try {
      const url = await uploadSingle(file);
      const response = await fetch(`/api/student/airport-pickup/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentProofUrl: url, paymentProofName: file.name }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to resubmit payment proof");
      await loadAll();
    } catch (resubmitError) {
      setError(resubmitError instanceof Error ? resubmitError.message : "Failed to resubmit payment proof");
    }
  }

  const topCards = [
    { key: "accommodation" as const, title: "Find Accommodation", icon: Home },
    { key: "jobs" as const, title: "Find Jobs", icon: Briefcase },
    { key: "pickup" as const, title: "Book Airport Pickup", icon: Plane },
    { key: "events" as const, title: "Pre-Departure Events", icon: CalendarDays },
  ].filter((card) => (card.key === "pickup" ? isVisaApproved : true));

  return (
    <div className="space-y-6 overflow-x-hidden pb-24 md:pb-0">
      <h1 className="text-2xl font-semibold">Student Services</h1>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="grid grid-cols-2 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {topCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setActiveSection(card.key)}
              className={`min-h-[100px] rounded-xl border p-5 text-left transition md:min-h-0 ${activeSection === card.key ? "border-blue-500 bg-blue-50" : "bg-white hover:bg-slate-50"}`}
            >
              <Icon className="h-8 w-8 text-blue-700 md:h-7 md:w-7" />
              <p className="mt-3 text-base font-bold">{card.title}</p>
            </button>
          );
        })}
      </section>

      {activeSection === "accommodation" ? (
        <section className="space-y-5 rounded-xl border bg-white p-5 sm:p-5">
          <h2 className="text-lg font-semibold">Find Accommodation</h2>
          <input
            value={accSearch}
            onChange={(event) => setAccSearch(event.target.value)}
            placeholder="Search by city or country"
            className="min-h-11 w-full rounded-md border px-3 py-2"
          />
          <div className="grid gap-3 md:grid-cols-4">
            <select value={accCountry} onChange={(event) => setAccCountry(event.target.value)} className="min-h-11 rounded-md border px-3 py-2">
              <option value="">All countries</option>
              {COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
            </select>
            <input value={accMaxPrice} onChange={(event) => setAccMaxPrice(event.target.value)} placeholder="Max price per month" type="number" className="min-h-11 rounded-md border px-3 py-2" />
            <label className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2"><input type="checkbox" checked={accFurnished} onChange={(event) => setAccFurnished(event.target.checked)} />Furnished</label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2"><input type="checkbox" checked={accBills} onChange={(event) => setAccBills(event.target.checked)} />Bills Included</label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredAccommodation.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-xl border">
                <div className="relative h-40 w-full">
                  <Image
                    src={item.images[0] || placeholderImage}
                    alt={item.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
                <div className="space-y-2 p-4">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="flex items-center gap-1 text-sm text-slate-600"><MapPin className="h-4 w-4" />{item.city}, {item.country}</p>
                  <p className="text-sm font-medium">{item.currency} {item.price ?? "-"} / month</p>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1"><Wifi className="h-3 w-3" />WiFi</span>
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1"><CookingPot className="h-3 w-3" />Kitchen</span>
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1"><Bed className="h-3 w-3" />Furnished</span>
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1"><Receipt className="h-3 w-3" />Bills</span>
                  </div>
                  <p className="text-xs text-slate-600">Available from: {item.availableFrom ? new Date(item.availableFrom).toLocaleDateString() : "-"}</p>
                  <div className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">
                    This listing is exclusively available through EduQuantica. All enquiries must be made through our platform to ensure you receive our full support.
                  </div>
                  <button type="button" onClick={() => setEnquireListing(item)} className="min-h-12 w-full rounded-md bg-[#F5A623] px-3 py-2 text-sm font-medium text-white hover:bg-[#e39a14]">Enquire Through EduQuantica</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeSection === "jobs" ? (
        <section className="space-y-5 rounded-xl border bg-white p-5 sm:p-5">
          <h2 className="text-lg font-semibold">Find Jobs</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <select value={jobType} onChange={(event) => setJobType(event.target.value)} className="min-h-11 rounded-md border px-3 py-2">
              <option value="ALL">All</option>
              <option value="Full Time">Full Time</option>
              <option value="Part Time">Part Time</option>
              <option value="Internship">Internship</option>
              <option value="Graduate Scheme">Graduate Scheme</option>
            </select>
            <input value={jobSector} onChange={(event) => setJobSector(event.target.value)} placeholder="Sector" className="min-h-11 rounded-md border px-3 py-2" />
            <input value={jobCountry} onChange={(event) => setJobCountry(event.target.value)} placeholder="Country" className="min-h-11 rounded-md border px-3 py-2" />
            <label className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2"><input type="checkbox" checked={jobRemote} onChange={(event) => setJobRemote(event.target.checked)} />Remote</label>
          </div>

          <div className="space-y-3">
            {filteredJobs.map((item) => (
              <article key={item.id} className="rounded-xl border p-4">
                <h3 className="font-semibold">{item.jobTitle || item.title}</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">{item.jobType || "N/A"}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{item.isRemote ? "Remote" : item.city}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">Salary: {item.salaryMin != null || item.salaryMax != null ? `${item.currency} ${item.salaryMin ?? "-"} - ${item.salaryMax ?? "-"}` : "Not specified"}</p>
                <p className="text-sm text-slate-700">Application deadline: {item.applicationDeadline ? new Date(item.applicationDeadline).toLocaleDateString() : "-"}</p>
                <p className="text-sm text-slate-700">Hours per week: {item.hoursPerWeek ?? "-"}</p>
                <div className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">
                  This listing is exclusively available through EduQuantica. All enquiries must be made through our platform to ensure you receive our full support.
                </div>
                <button type="button" onClick={() => setEnquireListing(item)} className="mt-3 min-h-12 w-full rounded-md bg-[#F5A623] px-3 py-2 text-sm font-medium text-white hover:bg-[#e39a14]">Enquire Through EduQuantica</button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeSection === "pickup" ? (
        <section className="space-y-5 rounded-xl border bg-white p-5 pb-28 md:pb-5 sm:p-5">
          <h2 className="text-lg font-semibold">Airport Pickup Booking</h2>
          {!isVisaApproved ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Airport pickup booking will be available once your visa is approved.</p>
          ) : pickupSuccess ? (
            <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
              <p className="text-lg font-bold">Booking Reference: {pickupSuccess.reference}</p>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Payment verification in progress. We will confirm within 24 hours.
              </div>
              <p>Someone will meet you at {pickupSuccess.airport} once payment is confirmed.</p>
            </div>
          ) : (
            <form className="space-y-4 pb-24 md:pb-0" onSubmit={confirmBooking}>
              <div className="space-y-2 rounded bg-slate-100 p-3 text-sm">
                <div>Step {pickupStep} of 4</div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-blue-700 transition-all" style={{ width: `${pickupStep * 25}%` }} />
                </div>
              </div>

              {pickupStep === 1 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <input required value={pickupForm.destinationCity} onChange={(event) => setPickupForm((current) => ({ ...current, destinationCity: event.target.value }))} placeholder="Destination city" className="min-h-11 w-full rounded-md border px-3 py-2" />
                  <select required value={pickupForm.destinationCountry} onChange={(event) => setPickupForm((current) => ({ ...current, destinationCountry: event.target.value, airport: "", otherAirport: "" }))} className="min-h-11 w-full rounded-md border px-3 py-2">
                    {(["UK", "Canada", "Australia", "USA", "Ireland", "New Zealand", "Other"] as const).map((country) => <option key={country} value={country}>{country}</option>)}
                  </select>
                  {pickupForm.destinationCountry === "Other" ? (
                    <input required value={pickupForm.otherAirport} onChange={(event) => setPickupForm((current) => ({ ...current, otherAirport: event.target.value }))} placeholder="Airport" className="min-h-11 w-full rounded-md border px-3 py-2" />
                  ) : (
                    <select required value={pickupForm.airport} onChange={(event) => setPickupForm((current) => ({ ...current, airport: event.target.value }))} className="min-h-11 w-full rounded-md border px-3 py-2">
                      <option value="">Select airport</option>
                      {(airportsByCountry[pickupForm.destinationCountry] || []).map((airport) => <option key={airport} value={airport}>{airport}</option>)}
                    </select>
                  )}
                  <input value={pickupForm.terminal} onChange={(event) => setPickupForm((current) => ({ ...current, terminal: event.target.value }))} placeholder="Terminal (optional)" className="min-h-11 w-full rounded-md border px-3 py-2" />
                  <input required value={pickupForm.flightNumber} onChange={(event) => setPickupForm((current) => ({ ...current, flightNumber: event.target.value }))} placeholder="Flight number" className="min-h-11 w-full rounded-md border px-3 py-2" />
                  <select required value={pickupForm.departureCountry} onChange={(event) => setPickupForm((current) => ({ ...current, departureCountry: event.target.value }))} className="min-h-11 w-full rounded-md border px-3 py-2">
                    <option value="">Departure country</option>
                    {COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
                  </select>
                  <input required value={pickupForm.departureCity} onChange={(event) => setPickupForm((current) => ({ ...current, departureCity: event.target.value }))} placeholder="Departure city" className="min-h-11 w-full rounded-md border px-3 py-2" />
                  <input required type="date" value={pickupForm.departureDate} onChange={(event) => setPickupForm((current) => ({ ...current, departureDate: event.target.value }))} className="min-h-11 w-full rounded-md border px-3 py-2" />
                  <input required type="time" value={pickupForm.departureTime} onChange={(event) => setPickupForm((current) => ({ ...current, departureTime: event.target.value }))} className="min-h-11 w-full rounded-md border px-3 py-2" />
                  <input required type="date" value={pickupForm.arrivalDate} onChange={(event) => setPickupForm((current) => ({ ...current, arrivalDate: event.target.value }))} className="min-h-11 w-full rounded-md border px-3 py-2" />
                  <input required type="time" value={pickupForm.arrivalTime} onChange={(event) => setPickupForm((current) => ({ ...current, arrivalTime: event.target.value }))} className="min-h-11 w-full rounded-md border px-3 py-2" />
                  <input required type="number" min={1} value={pickupForm.passengerCount} onChange={(event) => setPickupForm((current) => ({ ...current, passengerCount: Number(event.target.value || 1) }))} className="min-h-11 w-full rounded-md border px-3 py-2" />
                  <div className="fixed inset-x-0 bottom-0 z-10 flex gap-3 border-t bg-white p-4 md:static md:col-span-2 md:justify-end md:border-0 md:bg-transparent md:p-0"><button type="button" onClick={() => setPickupStep(2)} className="min-h-14 w-full rounded-md bg-[#1B2A4A] px-4 py-2 text-white md:min-h-11 md:w-auto md:bg-blue-600">Next</button></div>
                </div>
              ) : null}

              {pickupStep === 2 ? (
                <div className="space-y-3">
                  <label className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-sm text-slate-600">
                    Drag and drop or click to upload (PDF, JPG, PNG, max 10MB)
                    <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(event) => void onFileSelect(event, "ticket")} />
                  </label>
                  <button type="button" className="inline-flex min-h-12 items-center gap-2 rounded-md border px-3 py-2 text-sm text-slate-700"><QrCode className="h-5 w-5 md:h-4 md:w-4" />Upload via mobile QR</button>
                  {ticketUpload ? (
                    <div className="rounded-md border bg-slate-50 p-3 text-sm">
                      <p>Uploaded: {ticketUpload.fileName}</p>
                      {ticketUpload.previewUrl ? (
                        <Image
                          src={ticketUpload.previewUrl}
                          alt="Ticket preview"
                          width={640}
                          height={256}
                          unoptimized
                          className="mt-2 max-h-40 w-auto rounded border"
                        />
                      ) : null}
                    </div>
                  ) : null}
                  <div className="fixed inset-x-0 bottom-0 z-10 flex gap-3 border-t bg-white p-4 md:static md:justify-between md:border-0 md:bg-transparent md:p-0">
                    <button type="button" onClick={() => setPickupStep(1)} className="min-h-14 w-full rounded-md border bg-white px-4 py-2 text-slate-900 md:min-h-11 md:w-auto">Back</button>
                    <button type="button" disabled={!ticketUpload} onClick={() => setPickupStep(3)} className="min-h-14 w-full rounded-md bg-[#1B2A4A] px-4 py-2 text-white disabled:opacity-50 md:min-h-11 md:w-auto md:bg-blue-600">Next</button>
                  </div>
                </div>
              ) : null}

              {pickupStep === 3 ? (
                <div className="space-y-3">
                  <textarea value={pickupForm.specialRequirements} onChange={(event) => setPickupForm((current) => ({ ...current, specialRequirements: event.target.value }))} placeholder="Any special requirements?" className="min-h-24 w-full rounded-md border px-3 py-2" />
                  <div className="fixed inset-x-0 bottom-0 z-10 flex gap-3 border-t bg-white p-4 md:static md:justify-between md:border-0 md:bg-transparent md:p-0">
                    <button type="button" onClick={() => setPickupStep(2)} className="min-h-14 w-full rounded-md border bg-white px-4 py-2 text-slate-900 md:min-h-11 md:w-auto">Back</button>
                    <button type="button" onClick={() => setPickupStep(4)} className="min-h-14 w-full rounded-md bg-[#1B2A4A] px-4 py-2 text-white md:min-h-11 md:w-auto md:bg-blue-600">Next</button>
                  </div>
                </div>
              ) : null}

              {pickupStep === 4 ? (
                <div className="space-y-4">
                  <div className="w-full rounded-lg border bg-slate-50 p-4 text-sm">
                    <p className="font-semibold">Airport Pickup Booking Summary</p>
                    <p className="mt-2">From: {pickupForm.departureCity}, {pickupForm.departureCountry}</p>
                    <p>To: {selectedAirport || "-"}</p>
                    <p>Arrival: {pickupForm.arrivalDate} at {pickupForm.arrivalTime}</p>
                    <p>Passengers: {pickupForm.passengerCount}</p>
                    <hr className="my-2" />
                    {selectedPricing ? (
                      <>
                        <p>Service Fee: {selectedPricing.currency} {selectedPricing.amount}</p>
                        <p className="text-lg font-bold md:text-base">Total Due: {selectedPricing.currency} {selectedPricing.amount}</p>
                      </>
                    ) : (
                      <p>Contact us for pricing</p>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <button type="button" onClick={() => setPickupForm((current) => ({ ...current, paymentMethod: "BANK_TRANSFER" }))} className={`min-h-11 rounded-md border p-3 text-left ${pickupForm.paymentMethod === "BANK_TRANSFER" ? "border-blue-500" : ""}`}>
                      <p className="font-medium">Pay by Bank Transfer</p>
                      <p className="text-xs">Use your booking reference as payment reference so we can identify your payment.</p>
                    </button>
                    <button type="button" onClick={() => setPickupForm((current) => ({ ...current, paymentMethod: "IN_PERSON" }))} className={`min-h-11 rounded-md border p-3 text-left ${pickupForm.paymentMethod === "IN_PERSON" ? "border-blue-500" : ""}`}>
                      <p className="font-medium">Pay at EduQuantica Office</p>
                      <p className="text-xs">Visit any of our offices to pay. Bring booking reference after confirmation.</p>
                    </button>
                    <div className="rounded-md border border-dashed bg-slate-100 p-3 text-left text-slate-500 opacity-80">
                      <p className="inline-flex items-center gap-2 font-medium"><Lock className="h-4 w-4" />Online Payment - Coming Soon</p>
                      <p className="text-xs">We will notify you when available.</p>
                    </div>
                  </div>

                  {/* PAYMENT GATEWAY PLACEHOLDER */}
                  {/* Bank transfer proof only for now */}
                  {/* Replace when payment gateway integrated */}

                  {pickupForm.paymentMethod === "BANK_TRANSFER" ? (
                    <div className="space-y-3 rounded-lg border p-4 text-sm">
                      <div className="max-h-40 overflow-auto rounded-md bg-slate-50 p-3">
                      <p className="font-medium">Pay by Bank Transfer</p>
                      <hr className="my-2" />
                      <p>Account Name: {bankDetails.accountName || "-"}</p>
                      <p>Bank Name: {bankDetails.bankName || "-"}</p>
                      <p>Sort Code: {bankDetails.sortCode || "-"}</p>
                      <p>Account No: {bankDetails.accountNumber || "-"}</p>
                      <p>IBAN: {bankDetails.iban || "-"}</p>
                      <p>Reference: Use your booking reference after confirmation.</p>
                      <p className="mt-2 text-xs text-slate-600">Use your booking reference as payment reference so we can identify your payment.</p>
                      </div>
                      <label className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-5 text-sm text-slate-600">
                        Upload Payment Proof
                        <span className="mt-1 text-xs text-slate-500">Drag and drop or click to upload</span>
                        <span className="text-xs text-slate-500">Accepted: PDF, JPG, PNG max 10MB</span>
                        <span className="text-xs text-slate-500">Required before confirming booking</span>
                        <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(event) => void onFileSelect(event, "paymentProof")} />
                      </label>
                      {paymentProofUpload ? <p>Uploaded: {paymentProofUpload.fileName}</p> : null}
                    </div>
                  ) : null}

                  {pickupForm.paymentMethod === "IN_PERSON" ? (
                    <div className="space-y-2 rounded-lg border bg-white p-4 text-sm">
                      <p className="font-medium">Pay at EduQuantica Office</p>
                      <hr />
                      <p>Visit any of our offices to pay.</p>
                      <p>Bring booking reference after confirmation.</p>
                      <p>Our team confirms within 24 hours.</p>
                    </div>
                  ) : null}

                  {/* PAYMENT GATEWAY PLACEHOLDER */}
                  {/* Integrate Stripe or PayPal here */}
                  {/* Remove placeholder when ready */}

                  <div className="fixed inset-x-0 bottom-0 z-10 flex gap-3 border-t bg-white p-4 md:static md:justify-between md:border-0 md:bg-transparent md:p-0">
                    <button type="button" onClick={() => setPickupStep(3)} className="min-h-14 w-full rounded-md border bg-white px-4 py-2 text-slate-900 md:min-h-11 md:w-auto">Back</button>
                    <button type="submit" disabled={pickupSubmitting} className="min-h-14 w-full rounded-md bg-[#1B2A4A] px-4 py-2 text-white md:min-h-11 md:w-auto md:bg-green-600">{pickupSubmitting ? "Submitting..." : "Confirm Booking"}</button>
                  </div>
                </div>
              ) : null}
            </form>
          )}
        </section>
      ) : null}

      {activeSection === "events" ? (
        <section className="space-y-5 rounded-xl border bg-white p-5 sm:p-5">
          <h2 className="text-lg font-semibold">Pre-Departure Events</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {events.map((entry) => (
              <article key={entry.invitationId} className="rounded-lg border p-4">
                <p className="font-semibold">{entry.event.title}</p>
                <p className="mt-1 flex items-center gap-1 text-sm text-slate-600"><CalendarDays className="h-4 w-4" />{new Date(entry.event.eventDate).toLocaleDateString()} {entry.event.eventTime}</p>
                <p className="mt-1 text-sm">
                  <span className="rounded-full bg-slate-100 px-2 py-1">{entry.event.isOnline ? "Online" : entry.event.location}</span>
                </p>
                <p className="mt-2 text-sm">Target country: {entry.event.targetCountry}</p>
                <p className="mt-2 text-sm">RSVP: <span className="font-medium">{entry.rsvpStatus}</span></p>
                {entry.rsvpStatus === "PENDING" ? (
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => void rsvp(entry.invitationId, "ATTENDING")} className="min-h-11 rounded-md bg-green-600 px-3 py-2 text-sm text-white">I am Attending</button>
                    <button type="button" onClick={() => void rsvp(entry.invitationId, "NOT_ATTENDING")} className="min-h-11 rounded-md bg-red-600 px-3 py-2 text-sm text-white">I cannot Attend</button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-5 rounded-xl border bg-white p-5 sm:p-5">
        <div className="flex gap-2 border-b pb-2">
          <button type="button" onClick={() => setActiveBottomTab("applications")} className={`min-h-11 rounded-md px-3 py-2 text-sm ${activeBottomTab === "applications" ? "bg-blue-600 text-white" : "bg-slate-100"}`}>My Applications</button>
          <button type="button" onClick={() => setActiveBottomTab("referrals")} className={`min-h-11 rounded-md px-3 py-2 text-sm ${activeBottomTab === "referrals" ? "bg-blue-600 text-white" : "bg-slate-100"}`}>My Referrals</button>
          <button type="button" onClick={() => setActiveBottomTab("bookings")} className={`min-h-11 rounded-md px-3 py-2 text-sm ${activeBottomTab === "bookings" ? "bg-blue-600 text-white" : "bg-slate-100"}`}>My Bookings</button>
        </div>

        {activeBottomTab === "applications" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">Listing</th>
                  <th className="px-3 py-2">Provider Type</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Referral Code</th>
                  <th className="px-3 py-2">Date Applied</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2">{row.listing}</td>
                    <td className="px-3 py-2">{row.providerType}</td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2 font-mono">{row.referralCode}</td>
                    <td className="px-3 py-2">{new Date(row.dateApplied).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeBottomTab === "referrals" ? (
          <div className="space-y-3">
            {referrals.length === 0 ? (
              <p className="text-sm text-slate-600">No referrals found.</p>
            ) : (
              referrals.map((row) => (
                <article key={row.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{row.listing.title}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{row.status}</span>
                  </div>
                  <p className="mt-1 text-sm">Provider: {row.provider.name}</p>
                  <p className="text-sm">Location: {row.listing.city}, {row.listing.country}</p>
                  <p className="text-sm">Referral code: <span className="font-mono font-medium">{row.referralCode}</span></p>
                  <p className="text-sm">Created: {new Date(row.createdAt).toLocaleDateString()}</p>
                  <p className="text-sm">Follow-ups: {row.followUpCount}{row.followUpSentAt ? ` (last ${new Date(row.followUpSentAt).toLocaleDateString()})` : ""}</p>
                  <p className="text-sm">Student confirmation: {row.studentConfirmed ? `Yes (${row.studentConfirmedAt ? new Date(row.studentConfirmedAt).toLocaleDateString() : "confirmed"})` : "Pending"}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={row.studentConfirmed || row.status === "PLACED" || row.status === "REJECTED"}
                      onClick={() => void confirmReferral(row.id, true)}
                      className="min-h-11 rounded-md border border-green-200 px-3 py-2 text-sm text-green-700 hover:bg-green-50 disabled:opacity-60"
                    >
                      Yes, provider contacted me
                    </button>
                    <button
                      type="button"
                      disabled={row.status === "PLACED" || row.status === "REJECTED"}
                      onClick={() => void confirmReferral(row.id, false)}
                      className="min-h-11 rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      No, not contacted
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((row) => (
              <article key={row.id} className="rounded-lg border p-4">
                <p className="font-semibold">{row.airport} - {new Date(row.arrivalDate).toLocaleDateString()}</p>
                <p className="text-sm">Flight: {row.flightNumber}</p>
                <p className="text-sm">Status: {row.status}</p>
                {row.paymentStatus === "PENDING" || row.paymentStatus === "PROOF_UPLOADED" ? (
                  <div className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Payment being verified. 24 hours.</div>
                ) : null}
                {row.paymentStatus === "CONFIRMED" ? (
                  <div className="mt-2 space-y-2">
                    <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Payment confirmed. Pickup booked.</div>
                    {row.invoiceUrl ? <a href={row.invoiceUrl} className="inline-block min-h-11 rounded border px-3 py-2 text-sm" target="_blank" rel="noreferrer">Download Invoice</a> : null}
                  </div>
                ) : null}
                {row.paymentStatus === "REJECTED" ? (
                  <div className="mt-2 space-y-2">
                    <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">Payment verification failed. Reason: {row.rejectionReason || "Not provided"}. Please resubmit or contact info@eduquantica.com.</div>
                    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm">
                      Resubmit
                      <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(event) => void resubmitPayment(row.id, event.target.files?.[0] || null)} />
                    </label>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {enquireListing ? (
        <AppModal maxWidthClass="max-w-md">
          <div className="space-y-4">
            <p className="text-sm">Submit your enquiry for {enquireListing.title}?</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEnquireListing(null)} className="min-h-11 rounded-md border px-3 py-2 text-sm">Cancel</button>
              <button type="button" disabled={submittingEnquiry} onClick={() => void submitEnquiry()} className="min-h-11 rounded-md bg-[#F5A623] px-3 py-2 text-sm text-white">{submittingEnquiry ? "Submitting..." : "Confirm"}</button>
            </div>
          </div>
        </AppModal>
      ) : null}

      {enquirySuccess ? (
        <AppModal maxWidthClass="max-w-lg">
          <div className="space-y-3 text-sm">
            <p>Your enquiry has been submitted.</p>
            <p>Your referral code is: <span className="font-mono font-semibold">{enquirySuccess.code}</span></p>
            <p>Our team will connect you with this provider within 24 hours.</p>
            <p>Please quote this code in all communications.</p>
            <div className="flex justify-end"><button type="button" onClick={() => setEnquirySuccess(null)} className="min-h-11 rounded-md bg-blue-600 px-3 py-2 text-white">Close</button></div>
          </div>
        </AppModal>
      ) : null}

      {loading ? <p className="text-sm text-slate-600">Loading services...</p> : null}
    </div>
  );
}
