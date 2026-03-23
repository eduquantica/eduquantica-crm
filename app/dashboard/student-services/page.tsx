"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppModal from "@/components/ui/AppModal";
import ServicePaymentsTab from "@/components/dashboard/ServicePaymentsTab";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

const tabs = [
  "Providers",
  "Listings",
  "Applications",
  "Referrals",
  "Commissions",
  "Payments",
  "Airport Pickups",
] as const;

const providerTypes = [
  { value: "ACCOMMODATION", label: "Accommodation" },
  { value: "JOB_INTERNSHIP", label: "Job and Internship" },
  { value: "AIRPORT_PICKUP", label: "Airport Pickup" },
  { value: "HEALTH_INSURANCE", label: "Health Insurance" },
  { value: "BANK_ACCOUNT", label: "Bank Account" },
  { value: "SIM_CARD", label: "SIM Card" },
  { value: "OTHER", label: "Other" },
] as const;

type Provider = {
  id: string;
  name: string;
  type: (typeof providerTypes)[number]["value"];
  website: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string;
  commissionRate: number;
  contactPerson: string | null;
  contactEmail: string | null;
  notes: string | null;
  agreementSigned: boolean;
  agreementSignedAt: string | null;
  commissionProtected: boolean;
  isActive: boolean;
};

type ProviderForm = {
  name: string;
  type: Provider["type"];
  website: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  commissionRate: string;
  contactPerson: string;
  contactEmail: string;
  notes: string;
};

type ListingType = "ACCOMMODATION" | "JOB_INTERNSHIP" | "AIRPORT_PICKUP" | "OTHER";
type Listing = {
  id: string;
  providerId: string;
  type: ListingType;
  title: string;
  description: string | null;
  city: string;
  country: string;
  price: number | null;
  currency: string;
  availableFrom: string | null;
  availableTo: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  amenities: string[];
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
  isActive: boolean;
  isFeatured: boolean;
  provider: { id: string; name: string };
};

type ListingForm = {
  providerId: string;
  type: ListingType;
  title: string;
  description: string;
  city: string;
  country: string;
  price: string;
  currency: string;
  availableFrom: string;
  availableTo: string;
  bedrooms: string;
  bathrooms: string;
  amenities: string[];
  isFullyFurnished: boolean;
  isBillsIncluded: boolean;
  jobTitle: string;
  jobType: string;
  jobSector: string;
  salaryMin: string;
  salaryMax: string;
  hoursPerWeek: string;
  isRemote: boolean;
  applicationDeadline: string;
};

type ApplicationStatus = "ENQUIRED" | "REFERRED" | "SHORTLISTED" | "OFFERED" | "CONFIRMED" | "REJECTED" | "WITHDRAWN";
type ServiceApplication = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string | null;
  listingTitle: string;
  providerName: string;
  providerId: string;
  type: ListingType;
  status: ApplicationStatus;
  appliedDate: string;
  placementConfirmed: boolean;
  studentNote: string | null;
  adminNote: string | null;
};

type ReferralStatus = "SENT" | "CLICKED" | "ENQUIRED" | "SHORTLISTED" | "PLACED" | "REJECTED" | "EXPIRED";
type ServiceReferral = {
  id: string;
  referralCode: string;
  status: ReferralStatus;
  followUpCount: number;
  followUpSentAt: string | null;
  clickedAt: string | null;
  studentConfirmed: boolean;
  studentConfirmedAt: string | null;
  providerConfirmed: boolean;
  providerConfirmedAt: string | null;
  placementConfirmed: boolean;
  placementDate: string | null;
  commissionDue: number | null;
  commissionStatus: "PENDING" | "INVOICED" | "PAID" | "CANCELLED";
  createdAt: string;
  adminNote: string | null;
  student: { id: string; name: string; email: string | null; assignedCounsellorId: string | null };
  listing: { id: string; title: string; city: string; country: string };
  provider: { id: string; name: string };
};

type ReferralSummary = {
  total: number;
  sent: number;
  clicked: number;
  enquired: number;
  shortlisted: number;
  placed: number;
  rejected: number;
  expired: number;
};

type CommissionStatus = "PENDING" | "INVOICED" | "PAID" | "CANCELLED";
type ServiceCommission = {
  id: string;
  provider: { id: string; name: string };
  studentName: string;
  amount: number;
  currency: string;
  rate: number;
  status: CommissionStatus;
  invoicedAt: string | null;
  paidAt: string | null;
};

type CommissionSummary = {
  totalEarned: number;
  pending: number;
  invoiced: number;
  thisMonthEarned: number;
};

type ServicePricing = {
  id: string;
  serviceType: "AIRPORT_PICKUP" | "ACCOMMODATION_DEPOSIT" | "PRE_DEPARTURE_EVENT" | "OTHER_SERVICE";
  name: string;
  airport: string | null;
  amount: number;
  currency: string;
  isActive: boolean;
};

type PricingForm = {
  serviceType: ServicePricing["serviceType"];
  name: string;
  airport: string;
  amount: string;
  currency: "GBP" | "USD" | "CAD" | "AUD";
};

type AirportPickupStatus = "PENDING" | "CONFIRMED" | "ASSIGNED" | "COMPLETED" | "CANCELLED";
type PaymentStatus = "PENDING" | "PROOF_UPLOADED" | "CONFIRMED" | "REJECTED" | "REFUNDED" | "CANCELLED";
type AirportBooking = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string | null;
  studentPhone: string | null;
  destinationCountry: string;
  destinationCity: string;
  airport: string;
  terminal: string | null;
  flightNumber: string;
  departureCountry: string;
  departureCity: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  ticketConfirmationUrl: string | null;
  passengerCount: number;
  specialRequirements: string | null;
  status: AirportPickupStatus;
  adminNote: string | null;
  paymentStatus: PaymentStatus | null;
  paymentProofUrl: string | null;
  paymentProofName: string | null;
};

const applicationStatuses = [
  { value: "ALL", label: "All" },
  { value: "ENQUIRED", label: "Enquired" },
  { value: "REFERRED", label: "Referred" },
  { value: "SHORTLISTED", label: "Shortlisted" },
  { value: "OFFERED", label: "Offered" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
] as const;

const applicationTypeFilters = [
  { value: "ALL", label: "All" },
  { value: "ACCOMMODATION", label: "Accommodation" },
  { value: "JOB_INTERNSHIP", label: "Job and Internship" },
  { value: "OTHER", label: "Other" },
] as const;

const statusBadgeClass: Record<ApplicationStatus, string> = {
  ENQUIRED: "bg-slate-200 text-slate-700",
  REFERRED: "bg-blue-100 text-blue-700",
  SHORTLISTED: "bg-amber-100 text-amber-700",
  OFFERED: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  WITHDRAWN: "bg-slate-200 text-slate-700",
};

const referralBadgeClass: Record<ReferralStatus, string> = {
  SENT: "bg-slate-200 text-slate-700",
  CLICKED: "bg-indigo-100 text-indigo-700",
  ENQUIRED: "bg-blue-100 text-blue-700",
  SHORTLISTED: "bg-amber-100 text-amber-700",
  PLACED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-slate-300 text-slate-700",
};

const commissionBadgeClass: Record<CommissionStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  INVOICED: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  CANCELLED: "bg-slate-200 text-slate-700",
};

const airportStatusFilters = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

const airportStatusBadgeClass: Record<AirportPickupStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-green-100 text-green-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-slate-200 text-slate-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const paymentBadgeClass: Record<PaymentStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  PROOF_UPLOADED: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  REFUNDED: "bg-slate-200 text-slate-700",
  CANCELLED: "bg-slate-200 text-slate-700",
};

const amenityOptions = [
  "WiFi",
  "Washing Machine",
  "Kitchen",
  "Bills Included",
  "Gym",
  "Garden",
  "Parking",
  "Security",
  "CCTV",
] as const;

const listingTypeFilters = [
  { value: "ALL", label: "All" },
  { value: "ACCOMMODATION", label: "Accommodation" },
  { value: "JOB_INTERNSHIP", label: "Job and Internship" },
  { value: "AIRPORT_PICKUP", label: "Airport Pickup" },
  { value: "OTHER", label: "Other" },
] as const;

const jobTypeOptions = ["Full Time", "Part Time", "Internship", "Graduate Scheme"] as const;
const jobSectorOptions = [
  "Healthcare",
  "Technology",
  "Finance",
  "Education",
  "Hospitality",
  "Retail",
  "Construction",
  "Other",
] as const;

const emptyForm = (): ProviderForm => ({
  name: "",
  type: "ACCOMMODATION",
  website: "",
  email: "",
  phone: "",
  city: "",
  country: "",
  commissionRate: "10",
  contactPerson: "",
  contactEmail: "",
  notes: "",
});

const emptyListingForm = (): ListingForm => ({
  providerId: "",
  type: "ACCOMMODATION",
  title: "",
  description: "",
  city: "",
  country: "",
  price: "",
  currency: "GBP",
  availableFrom: "",
  availableTo: "",
  bedrooms: "",
  bathrooms: "",
  amenities: [],
  isFullyFurnished: false,
  isBillsIncluded: false,
  jobTitle: "",
  jobType: "Full Time",
  jobSector: "Technology",
  salaryMin: "",
  salaryMax: "",
  hoursPerWeek: "",
  isRemote: false,
  applicationDeadline: "",
});

const emptyPricingForm = (): PricingForm => ({
  serviceType: "AIRPORT_PICKUP",
  name: "",
  airport: "",
  amount: "",
  currency: "GBP",
});

export default function StudentServicesPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Providers");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [form, setForm] = useState<ProviderForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState("");
  const [listingsTypeFilter, setListingsTypeFilter] = useState<(typeof listingTypeFilters)[number]["value"]>("ALL");
  const [listingsCountryFilter, setListingsCountryFilter] = useState("");
  const [listingsProviderFilter, setListingsProviderFilter] = useState("");
  const [listingsActiveOnly, setListingsActiveOnly] = useState(false);
  const [listingsDeletingId, setListingsDeletingId] = useState<string | null>(null);
  const [listingsUpdatingId, setListingsUpdatingId] = useState<string | null>(null);
  const [listingModalOpen, setListingModalOpen] = useState(false);
  const [listingModalStep, setListingModalStep] = useState<"type" | "form">("type");
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [listingForm, setListingForm] = useState<ListingForm>(emptyListingForm);
  const [listingSaving, setListingSaving] = useState(false);

  const [applications, setApplications] = useState<ServiceApplication[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsError, setApplicationsError] = useState("");
  const [applicationStatusFilter, setApplicationStatusFilter] = useState<(typeof applicationStatuses)[number]["value"]>("ALL");
  const [applicationTypeFilter, setApplicationTypeFilter] = useState<(typeof applicationTypeFilters)[number]["value"]>("ALL");
  const [applicationStudentSearch, setApplicationStudentSearch] = useState("");
  const [selectedApplication, setSelectedApplication] = useState<ServiceApplication | null>(null);
  const [applicationModalOpen, setApplicationModalOpen] = useState(false);
  const [applicationSaving, setApplicationSaving] = useState(false);
  const [applicationEditStatus, setApplicationEditStatus] = useState<ApplicationStatus>("ENQUIRED");
  const [applicationEditAdminNote, setApplicationEditAdminNote] = useState("");
  const [applicationPlacementConfirmed, setApplicationPlacementConfirmed] = useState(false);

  const [referrals, setReferrals] = useState<ServiceReferral[]>([]);
  const [referralsSummary, setReferralsSummary] = useState<ReferralSummary>({
    total: 0,
    sent: 0,
    clicked: 0,
    enquired: 0,
    shortlisted: 0,
    placed: 0,
    rejected: 0,
    expired: 0,
  });
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [referralsError, setReferralsError] = useState("");
  const [referralStatusFilter, setReferralStatusFilter] = useState<ReferralStatus | "ALL">("ALL");
  const [referralSearch, setReferralSearch] = useState("");
  const [referralsUpdatingId, setReferralsUpdatingId] = useState<string | null>(null);

  const [commissions, setCommissions] = useState<ServiceCommission[]>([]);
  const [commissionsSummary, setCommissionsSummary] = useState<CommissionSummary>({ totalEarned: 0, pending: 0, invoiced: 0, thisMonthEarned: 0 });
  const [commissionsLoading, setCommissionsLoading] = useState(false);
  const [commissionsError, setCommissionsError] = useState("");
  const [commissionsUpdatingId, setCommissionsUpdatingId] = useState<string | null>(null);

  const [pricing, setPricing] = useState<ServicePricing[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState("");
  const [pricingEditingId, setPricingEditingId] = useState<string | null>(null);
  const [pricingEditValues, setPricingEditValues] = useState<Partial<PricingForm>>({});
  const [pricingSaving, setPricingSaving] = useState(false);
  const [addPriceModalOpen, setAddPriceModalOpen] = useState(false);
  const [newPriceForm, setNewPriceForm] = useState<PricingForm>(emptyPricingForm);

  const [airportBookings, setAirportBookings] = useState<AirportBooking[]>([]);
  const [airportLoading, setAirportLoading] = useState(false);
  const [airportError, setAirportError] = useState("");
  const [airportStatusFilter, setAirportStatusFilter] = useState<(typeof airportStatusFilters)[number]["value"]>("ALL");
  const [airportDestinationFilter, setAirportDestinationFilter] = useState("");
  const [airportFromDate, setAirportFromDate] = useState("");
  const [airportToDate, setAirportToDate] = useState("");
  const [airportStudentSearch, setAirportStudentSearch] = useState("");
  const [airportView, setAirportView] = useState<"table" | "calendar">("table");
  const [airportUpdatingId, setAirportUpdatingId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<AirportBooking | null>(null);
  const [airportModalOpen, setAirportModalOpen] = useState(false);
  const [airportNoteModalOpen, setAirportNoteModalOpen] = useState(false);
  const [airportNoteBooking, setAirportNoteBooking] = useState<AirportBooking | null>(null);
  const [airportNoteText, setAirportNoteText] = useState("");
  const [airportModalStatus, setAirportModalStatus] = useState<AirportPickupStatus>("PENDING");
  const [airportModalAdminNote, setAirportModalAdminNote] = useState("");
  const [airportCancelReason, setAirportCancelReason] = useState("");
  const [airportCalendarMonth, setAirportCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const loadProviders = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/service-providers", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to fetch providers");
      setProviders(Array.isArray(result.data) ? result.data : []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch providers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProviders();
  }, []);

  const loadListings = useCallback(async () => {
    setListingsLoading(true);
    setListingsError("");
    try {
      const params = new URLSearchParams();
      if (listingsTypeFilter !== "ALL") params.set("type", listingsTypeFilter);
      if (listingsCountryFilter.trim()) params.set("country", listingsCountryFilter.trim());
      if (listingsProviderFilter) params.set("providerId", listingsProviderFilter);
      if (listingsActiveOnly) params.set("active", "true");
      const query = params.toString();
      const response = await fetch(`/api/admin/service-listings${query ? `?${query}` : ""}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to fetch listings");
      setListings(Array.isArray(result.data) ? result.data : []);
    } catch (fetchError) {
      setListingsError(fetchError instanceof Error ? fetchError.message : "Failed to fetch listings");
    } finally {
      setListingsLoading(false);
    }
  }, [listingsActiveOnly, listingsCountryFilter, listingsProviderFilter, listingsTypeFilter]);

  useEffect(() => {
    if (activeTab !== "Listings") return;
    void loadListings();
  }, [activeTab, loadListings]);

  const loadApplications = useCallback(async () => {
    setApplicationsLoading(true);
    setApplicationsError("");
    try {
      const params = new URLSearchParams();
      if (applicationStatusFilter !== "ALL") params.set("status", applicationStatusFilter);
      if (applicationTypeFilter !== "ALL") params.set("type", applicationTypeFilter);
      if (applicationStudentSearch.trim()) params.set("studentSearch", applicationStudentSearch.trim());
      const query = params.toString();
      const response = await fetch(`/api/admin/service-applications${query ? `?${query}` : ""}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to fetch applications");
      setApplications(Array.isArray(result.data) ? result.data : []);
    } catch (fetchError) {
      setApplicationsError(fetchError instanceof Error ? fetchError.message : "Failed to fetch applications");
    } finally {
      setApplicationsLoading(false);
    }
  }, [applicationStatusFilter, applicationStudentSearch, applicationTypeFilter]);

  useEffect(() => {
    if (activeTab !== "Applications") return;
    void loadApplications();
  }, [activeTab, loadApplications]);

  const loadReferrals = useCallback(async () => {
    setReferralsLoading(true);
    setReferralsError("");
    try {
      const params = new URLSearchParams();
      if (referralStatusFilter !== "ALL") params.set("status", referralStatusFilter);
      if (referralSearch.trim()) params.set("search", referralSearch.trim());
      const query = params.toString();
      const response = await fetch(`/api/admin/service-referrals${query ? `?${query}` : ""}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to fetch referrals");
      setReferrals(Array.isArray(result.data) ? result.data : []);
      setReferralsSummary(result.summary || {
        total: 0,
        sent: 0,
        clicked: 0,
        enquired: 0,
        shortlisted: 0,
        placed: 0,
        rejected: 0,
        expired: 0,
      });
    } catch (fetchError) {
      setReferralsError(fetchError instanceof Error ? fetchError.message : "Failed to fetch referrals");
    } finally {
      setReferralsLoading(false);
    }
  }, [referralSearch, referralStatusFilter]);

  useEffect(() => {
    if (activeTab !== "Referrals") return;
    void loadReferrals();
  }, [activeTab, loadReferrals]);

  const runReferralAction = async (
    referral: ServiceReferral,
    payload: { action?: "CHASE" | "UPDATE"; status?: ReferralStatus },
  ) => {
    setReferralsUpdatingId(referral.id);
    setReferralsError("");
    try {
      const response = await fetch("/api/admin/service-referrals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: referral.id, ...payload }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to update referral");
      await loadReferrals();
    } catch (updateError) {
      setReferralsError(updateError instanceof Error ? updateError.message : "Failed to update referral");
    } finally {
      setReferralsUpdatingId(null);
    }
  };

  const openApplicationModal = (item: ServiceApplication) => {
    setSelectedApplication(item);
    setApplicationEditStatus(item.status);
    setApplicationEditAdminNote(item.adminNote || "");
    setApplicationPlacementConfirmed(item.placementConfirmed);
    setApplicationModalOpen(true);
  };

  const saveApplication = async () => {
    if (!selectedApplication) return;
    setApplicationSaving(true);
    setApplicationsError("");
    try {
      const response = await fetch("/api/admin/service-applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedApplication.id,
          status: applicationEditStatus,
          adminNote: applicationEditAdminNote || null,
          placementConfirmed: applicationPlacementConfirmed,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to update application");
      setApplicationModalOpen(false);
      await loadApplications();
    } catch (saveError) {
      setApplicationsError(saveError instanceof Error ? saveError.message : "Failed to update application");
    } finally {
      setApplicationSaving(false);
    }
  };

  const loadCommissions = useCallback(async () => {
    setCommissionsLoading(true);
    setCommissionsError("");
    try {
      const response = await fetch("/api/admin/service-commissions", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to fetch commissions");
      setCommissions(Array.isArray(result.data) ? result.data : []);
      setCommissionsSummary(result.summary || { totalEarned: 0, pending: 0, invoiced: 0, thisMonthEarned: 0 });
    } catch (fetchError) {
      setCommissionsError(fetchError instanceof Error ? fetchError.message : "Failed to fetch commissions");
    } finally {
      setCommissionsLoading(false);
    }
  }, []);

  const loadPricing = useCallback(async () => {
    setPricingLoading(true);
    setPricingError("");
    try {
      const response = await fetch("/api/admin/service-pricing", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to fetch pricing");
      setPricing(Array.isArray(result.data) ? result.data : []);
    } catch (fetchError) {
      setPricingError(fetchError instanceof Error ? fetchError.message : "Failed to fetch pricing");
    } finally {
      setPricingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "Commissions") return;
    void loadCommissions();
    void loadPricing();
  }, [activeTab, loadCommissions, loadPricing]);

  const updateCommissionStatus = async (item: ServiceCommission, nextStatus: "INVOICED" | "PAID") => {
    setCommissionsUpdatingId(item.id);
    setCommissionsError("");
    try {
      const response = await fetch("/api/admin/service-commissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, status: nextStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to update commission");
      await loadCommissions();
    } catch (updateError) {
      setCommissionsError(updateError instanceof Error ? updateError.message : "Failed to update commission");
    } finally {
      setCommissionsUpdatingId(null);
    }
  };

  const startPricingEdit = (row: ServicePricing) => {
    setPricingEditingId(row.id);
    setPricingEditValues({
      serviceType: row.serviceType,
      name: row.name,
      airport: row.airport || "",
      amount: String(row.amount),
      currency: (row.currency as PricingForm["currency"]) || "GBP",
    });
  };

  const savePricingEdit = async (id: string) => {
    setPricingSaving(true);
    setPricingError("");
    try {
      const response = await fetch(`/api/admin/service-pricing/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: pricingEditValues.serviceType,
          name: pricingEditValues.name,
          airport: pricingEditValues.airport || null,
          amount: pricingEditValues.amount ? Number(pricingEditValues.amount) : undefined,
          currency: pricingEditValues.currency,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to update price");
      setPricingEditingId(null);
      await loadPricing();
    } catch (saveError) {
      setPricingError(saveError instanceof Error ? saveError.message : "Failed to update price");
    } finally {
      setPricingSaving(false);
    }
  };

  const saveNewPrice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPricingSaving(true);
    setPricingError("");
    try {
      const response = await fetch("/api/admin/service-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: newPriceForm.serviceType,
          name: newPriceForm.name,
          airport: newPriceForm.airport || null,
          amount: Number(newPriceForm.amount),
          currency: newPriceForm.currency,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to create price");
      setAddPriceModalOpen(false);
      setNewPriceForm(emptyPricingForm());
      await loadPricing();
    } catch (saveError) {
      setPricingError(saveError instanceof Error ? saveError.message : "Failed to create price");
    } finally {
      setPricingSaving(false);
    }
  };

  const toggleListingFlag = async (listing: Listing, field: "isFeatured" | "isActive", value: boolean) => {
    setListingsUpdatingId(listing.id);
    setListingsError("");
    try {
      const response = await fetch(`/api/admin/service-listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to update listing");
      setListings((current) => current.map((item) => (item.id === listing.id ? { ...item, [field]: value } : item)));
    } catch (updateError) {
      setListingsError(updateError instanceof Error ? updateError.message : "Failed to update listing");
    } finally {
      setListingsUpdatingId(null);
    }
  };

  const openListingTypeModal = () => {
    setEditingListing(null);
    setListingForm(emptyListingForm());
    setListingModalStep("type");
    setListingModalOpen(true);
  };

  const chooseListingType = (type: "ACCOMMODATION" | "JOB_INTERNSHIP") => {
    setListingForm((current) => ({ ...current, type }));
    setListingModalStep("form");
  };

  const openEditListingModal = (listing: Listing) => {
    setEditingListing(listing);
    setListingForm({
      providerId: listing.providerId,
      type: listing.type,
      title: listing.title,
      description: listing.description || "",
      city: listing.city,
      country: listing.country,
      price: listing.price == null ? "" : String(listing.price),
      currency: listing.currency || "GBP",
      availableFrom: listing.availableFrom ? String(listing.availableFrom).slice(0, 10) : "",
      availableTo: listing.availableTo ? String(listing.availableTo).slice(0, 10) : "",
      bedrooms: listing.bedrooms == null ? "" : String(listing.bedrooms),
      bathrooms: listing.bathrooms == null ? "" : String(listing.bathrooms),
      amenities: listing.amenities || [],
      isFullyFurnished: listing.isFullyFurnished,
      isBillsIncluded: listing.isBillsIncluded,
      jobTitle: listing.jobTitle || listing.title,
      jobType: listing.jobType || "Full Time",
      jobSector: listing.jobSector || "Technology",
      salaryMin: listing.salaryMin == null ? "" : String(listing.salaryMin),
      salaryMax: listing.salaryMax == null ? "" : String(listing.salaryMax),
      hoursPerWeek: listing.hoursPerWeek == null ? "" : String(listing.hoursPerWeek),
      isRemote: listing.isRemote,
      applicationDeadline: listing.applicationDeadline ? String(listing.applicationDeadline).slice(0, 10) : "",
    });
    setListingModalStep("form");
    setListingModalOpen(true);
  };

  const closeListingModal = () => {
    if (listingSaving) return;
    setListingModalOpen(false);
    setEditingListing(null);
  };

  const listingPayload = {
    providerId: listingForm.providerId,
    type: listingForm.type,
    title: listingForm.type === "JOB_INTERNSHIP" ? listingForm.jobTitle : listingForm.title,
    description: listingForm.description || null,
    city: listingForm.city,
    country: listingForm.country,
    price: listingForm.price === "" ? null : Number(listingForm.price),
    currency: listingForm.currency || "GBP",
    availableFrom: listingForm.availableFrom || null,
    availableTo: listingForm.availableTo || null,
    bedrooms: listingForm.bedrooms === "" ? null : Number(listingForm.bedrooms),
    bathrooms: listingForm.bathrooms === "" ? null : Number(listingForm.bathrooms),
    amenities: listingForm.amenities,
    images: [],
    isFullyFurnished: listingForm.isFullyFurnished,
    isBillsIncluded: listingForm.isBillsIncluded,
    jobTitle: listingForm.type === "JOB_INTERNSHIP" ? listingForm.jobTitle : null,
    jobType: listingForm.type === "JOB_INTERNSHIP" ? listingForm.jobType : null,
    jobSector: listingForm.type === "JOB_INTERNSHIP" ? listingForm.jobSector : null,
    salaryMin: listingForm.salaryMin === "" ? null : Number(listingForm.salaryMin),
    salaryMax: listingForm.salaryMax === "" ? null : Number(listingForm.salaryMax),
    hoursPerWeek: listingForm.hoursPerWeek === "" ? null : Number(listingForm.hoursPerWeek),
    isRemote: listingForm.isRemote,
    eligibleNationalities: [],
    eligibleStudyLevels: [],
    applicationDeadline: listingForm.applicationDeadline || null,
  };

  const submitListing = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setListingSaving(true);
    setListingsError("");
    try {
      const response = await fetch(
        editingListing ? `/api/admin/service-listings/${editingListing.id}` : "/api/admin/service-listings",
        {
          method: editingListing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(listingPayload),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to save listing");
      closeListingModal();
      await loadListings();
    } catch (saveError) {
      setListingsError(saveError instanceof Error ? saveError.message : "Failed to save listing");
    } finally {
      setListingSaving(false);
    }
  };

  const deleteListing = async (listing: Listing) => {
    if (!window.confirm(`Delete ${listing.title}?`)) return;
    setListingsDeletingId(listing.id);
    setListingsError("");
    try {
      const response = await fetch(`/api/admin/service-listings/${listing.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to delete listing");
      await loadListings();
    } catch (deleteError) {
      setListingsError(deleteError instanceof Error ? deleteError.message : "Failed to delete listing");
    } finally {
      setListingsDeletingId(null);
    }
  };

  const openAddModal = () => {
    setEditingProvider(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEditModal = (provider: Provider) => {
    setEditingProvider(provider);
    setForm({
      name: provider.name,
      type: provider.type,
      website: provider.website || "",
      email: provider.email || "",
      phone: provider.phone || "",
      city: provider.city || "",
      country: provider.country,
      commissionRate: String(provider.commissionRate),
      contactPerson: provider.contactPerson || "",
      contactEmail: provider.contactEmail || "",
      notes: provider.notes || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingProvider(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        editingProvider ? `/api/admin/service-providers/${editingProvider.id}` : "/api/admin/service-providers",
        {
          method: editingProvider ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            type: form.type,
            website: form.website || null,
            email: form.email || null,
            phone: form.phone || null,
            city: form.city || null,
            country: form.country,
            commissionRate: Number(form.commissionRate),
            contactPerson: form.contactPerson || null,
            contactEmail: form.contactEmail || null,
            notes: form.notes || null,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to save provider");
      closeModal();
      await loadProviders();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save provider");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (provider: Provider) => {
    if (!window.confirm(`Delete ${provider.name}?`)) return;
    setDeletingId(provider.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/service-providers/${provider.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to delete provider");
      await loadProviders();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete provider");
    } finally {
      setDeletingId(null);
    }
  };

  const loadAirportBookings = useCallback(async () => {
    setAirportLoading(true);
    setAirportError("");
    try {
      const params = new URLSearchParams();
      if (airportStatusFilter !== "ALL") params.set("status", airportStatusFilter);
      if (airportDestinationFilter.trim()) params.set("destinationCountry", airportDestinationFilter.trim());
      if (airportFromDate) params.set("from", airportFromDate);
      if (airportToDate) params.set("to", airportToDate);
      const query = params.toString();
      const response = await fetch(`/api/admin/airport-pickup${query ? `?${query}` : ""}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to fetch airport pickups");
      setAirportBookings(Array.isArray(result.data) ? result.data : []);
    } catch (fetchError) {
      setAirportError(fetchError instanceof Error ? fetchError.message : "Failed to fetch airport pickups");
    } finally {
      setAirportLoading(false);
    }
  }, [airportDestinationFilter, airportFromDate, airportStatusFilter, airportToDate]);

  useEffect(() => {
    if (activeTab !== "Airport Pickups") return;
    void loadAirportBookings();
  }, [activeTab, loadAirportBookings]);

  const filteredAirportBookings = useMemo(() => {
    const query = airportStudentSearch.trim().toLowerCase();
    if (!query) return airportBookings;
    return airportBookings.filter((item) => item.studentName.toLowerCase().includes(query));
  }, [airportBookings, airportStudentSearch]);

  const openAirportDetail = (booking: AirportBooking) => {
    setSelectedBooking(booking);
    setAirportModalStatus(booking.status);
    setAirportModalAdminNote(booking.adminNote || "");
    setAirportCancelReason("");
    setAirportModalOpen(true);
  };

  const updateAirportBooking = async (booking: AirportBooking, payload: { status: AirportPickupStatus; adminNote?: string | null }) => {
    setAirportUpdatingId(booking.id);
    setAirportError("");
    try {
      const response = await fetch(`/api/admin/airport-pickup/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: payload.status,
          adminNote: payload.adminNote ?? booking.adminNote,
          confirmedBy: session?.user?.id || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to update booking");
      toast.success("Airport booking updated");
      await loadAirportBookings();
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Failed to update booking";
      setAirportError(message);
      toast.error(message);
    } finally {
      setAirportUpdatingId(null);
    }
  };

  const confirmAirportBooking = async (booking: AirportBooking) => {
    await updateAirportBooking(booking, { status: "CONFIRMED", adminNote: booking.adminNote || null });
  };

  const openAddNoteModal = (booking: AirportBooking) => {
    setAirportNoteBooking(booking);
    setAirportNoteText(booking.adminNote || "");
    setAirportNoteModalOpen(true);
  };

  const saveAirportNote = async () => {
    if (!airportNoteBooking) return;
    await updateAirportBooking(airportNoteBooking, { status: airportNoteBooking.status, adminNote: airportNoteText || null });
    setAirportNoteModalOpen(false);
  };

  const saveAirportModal = async () => {
    if (!selectedBooking) return;
    await updateAirportBooking(selectedBooking, { status: airportModalStatus, adminNote: airportModalAdminNote || null });
    setAirportModalOpen(false);
  };

  const cancelAirportFromModal = async () => {
    if (!selectedBooking) return;
    const note = [airportModalAdminNote, airportCancelReason ? `Cancel reason: ${airportCancelReason}` : ""]
      .filter(Boolean)
      .join("\n\n");
    await updateAirportBooking(selectedBooking, { status: "CANCELLED", adminNote: note || null });
    setAirportModalOpen(false);
  };

  const calendarCells = useMemo(() => {
    const start = new Date(airportCalendarMonth.getFullYear(), airportCalendarMonth.getMonth(), 1);
    const startDay = start.getDay();
    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - startDay);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      const items = filteredAirportBookings.filter((booking) => new Date(booking.arrivalDate).toISOString().slice(0, 10) === key);
      return { date, items, inMonth: date.getMonth() === airportCalendarMonth.getMonth() };
    });
  }, [airportCalendarMonth, filteredAirportBookings]);

  return (
    <main className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Student Services</h1>
        <Link
          href="/dashboard/student-services/events"
          className="rounded-md border border-[#F5A623] px-4 py-2 text-sm font-medium text-[#F5A623] hover:bg-amber-50"
        >
          Pre-Departure Events
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-3">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTab === tab
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <section className="rounded-lg border p-6">
        {activeTab === "Providers" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Providers</h2>
                <p className="mt-1 text-sm text-slate-600">Manage student services providers.</p>
              </div>
              <button
                type="button"
                onClick={openAddModal}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Add Provider
              </button>
            </div>

            {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">Commission Protection Notice</p>
              <p className="mt-1">Providers without a signed agreement are marked <strong>HIGH RISK</strong> — EduQuantica has no legally enforceable commission protection for these providers. Ensure all active providers have a signed agreement on file. Never share provider contact details with students directly; route all referrals through the platform to preserve commission protection.</p>
            </div>

            {loading ? (
              <p className="text-sm text-slate-600">Loading providers...</p>
            ) : providers.length === 0 ? (
              <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-slate-600">No providers found.</div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      {[
                        "Name",
                        "Type",
                        "Country",
                        "Commission %",
                        "Agreement Signed",
                        "Commission Risk",
                        "Status",
                        "Actions",
                      ].map((label) => (
                        <th key={label} className="px-4 py-3 font-medium">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {providers.map((provider) => (
                      <tr key={provider.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{provider.name}</td>
                        <td className="px-4 py-3">{providerTypes.find((item) => item.value === provider.type)?.label || provider.type}</td>
                        <td className="px-4 py-3">{provider.country}</td>
                        <td className="px-4 py-3">{provider.commissionRate}%</td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${provider.agreementSigned ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                              {provider.agreementSigned ? "Signed" : "Not Signed"}
                            </span>
                            {provider.agreementSignedAt ? (
                              <p className="text-xs text-slate-500">{new Date(provider.agreementSignedAt).toLocaleDateString()}</p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {!provider.agreementSigned ? (
                            <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">HIGH RISK</span>
                          ) : !provider.commissionProtected ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">MEDIUM RISK</span>
                          ) : (
                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">PROTECTED</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${provider.isActive ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-700"}`}>
                            {provider.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(provider)}
                              className="rounded-md border px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(provider)}
                              disabled={deletingId === provider.id}
                              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deletingId === provider.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === "Listings" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Listings</h2>
                <p className="mt-1 text-sm text-slate-600">Manage service listings.</p>
              </div>
              <button
                type="button"
                onClick={openListingTypeModal}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Add Listing
              </button>
            </div>

            <div className="grid gap-3 rounded-md border bg-slate-50 p-3 md:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span>Type</span>
                <select
                  value={listingsTypeFilter}
                  onChange={(event) => setListingsTypeFilter(event.target.value as (typeof listingTypeFilters)[number]["value"])}
                  className="w-full rounded-md border px-3 py-2"
                >
                  {listingTypeFilters.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Country</span>
                <input
                  value={listingsCountryFilter}
                  onChange={(event) => setListingsCountryFilter(event.target.value)}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="Filter by country"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>Provider</span>
                <select
                  value={listingsProviderFilter}
                  onChange={(event) => setListingsProviderFilter(event.target.value)}
                  className="w-full rounded-md border px-3 py-2"
                >
                  <option value="">All providers</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-end gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={listingsActiveOnly}
                  onChange={(event) => setListingsActiveOnly(event.target.checked)}
                />
                Active only
              </label>
            </div>

            {listingsError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{listingsError}</div>
            ) : null}

            {listingsLoading ? (
              <p className="text-sm text-slate-600">Loading listings...</p>
            ) : listings.length === 0 ? (
              <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-slate-600">No listings found.</div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      {[
                        "Title",
                        "Provider",
                        "Type",
                        "City/Country",
                        "Price",
                        "Featured",
                        "Active",
                        "Actions",
                      ].map((label) => (
                        <th key={label} className="px-4 py-3 font-medium">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {listings.map((listing) => (
                      <tr key={listing.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{listing.title}</td>
                        <td className="px-4 py-3">{listing.provider?.name || "-"}</td>
                        <td className="px-4 py-3">{providerTypes.find((item) => item.value === listing.type)?.label || listing.type}</td>
                        <td className="px-4 py-3">{listing.city}, {listing.country}</td>
                        <td className="px-4 py-3">{listing.price == null ? "-" : `${listing.currency} ${listing.price}`}</td>
                        <td className="px-4 py-3">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={listing.isFeatured}
                              disabled={listingsUpdatingId === listing.id}
                              onChange={(event) => void toggleListingFlag(listing, "isFeatured", event.target.checked)}
                            />
                            <span className="text-xs text-slate-600">{listing.isFeatured ? "Yes" : "No"}</span>
                          </label>
                        </td>
                        <td className="px-4 py-3">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={listing.isActive}
                              disabled={listingsUpdatingId === listing.id}
                              onChange={(event) => void toggleListingFlag(listing, "isActive", event.target.checked)}
                            />
                            <span className="text-xs text-slate-600">{listing.isActive ? "Yes" : "No"}</span>
                          </label>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openEditListingModal(listing)}
                              className="rounded-md border px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteListing(listing)}
                              disabled={listingsDeletingId === listing.id}
                              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {listingsDeletingId === listing.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === "Applications" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Applications</h2>
            </div>

            <div className="grid gap-3 rounded-md border bg-slate-50 p-3 md:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span>Status</span>
                <select
                  value={applicationStatusFilter}
                  onChange={(event) => setApplicationStatusFilter(event.target.value as (typeof applicationStatuses)[number]["value"])}
                  className="w-full rounded-md border px-3 py-2"
                >
                  {applicationStatuses.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Type</span>
                <select
                  value={applicationTypeFilter}
                  onChange={(event) => setApplicationTypeFilter(event.target.value as (typeof applicationTypeFilters)[number]["value"])}
                  className="w-full rounded-md border px-3 py-2"
                >
                  {applicationTypeFilters.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Student name search</span>
                <input
                  value={applicationStudentSearch}
                  onChange={(event) => setApplicationStudentSearch(event.target.value)}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="Search by student name"
                />
              </label>
            </div>

            {applicationsError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{applicationsError}</div>
            ) : null}

            {applicationsLoading ? (
              <p className="text-sm text-slate-600">Loading applications...</p>
            ) : applications.length === 0 ? (
              <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-slate-600">No applications found.</div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      {[
                        "Student Name",
                        "Listing Title",
                        "Provider",
                        "Type",
                        "Status",
                        "Applied Date",
                        "Placement Confirmed",
                        "Actions",
                      ].map((label) => (
                        <th key={label} className="px-4 py-3 font-medium">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {applications.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{item.studentName}</td>
                        <td className="px-4 py-3">{item.listingTitle}</td>
                        <td className="px-4 py-3">{item.providerName}</td>
                        <td className="px-4 py-3">{providerTypes.find((type) => type.value === item.type)?.label || item.type}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass[item.status]}`}>{item.status}</span>
                        </td>
                        <td className="px-4 py-3">{new Date(item.appliedDate).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-lg">{item.placementConfirmed ? <span className="text-green-600">✓</span> : <span className="text-slate-400">-</span>}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openApplicationModal(item)}
                            className="rounded-md border px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === "Referrals" ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
              {[
                { label: "Total", value: referralsSummary.total },
                { label: "Sent", value: referralsSummary.sent },
                { label: "Clicked", value: referralsSummary.clicked },
                { label: "Enquired", value: referralsSummary.enquired },
                { label: "Shortlisted", value: referralsSummary.shortlisted },
                { label: "Placed", value: referralsSummary.placed },
                { label: "Rejected", value: referralsSummary.rejected },
                { label: "Expired", value: referralsSummary.expired },
              ].map((card) => (
                <div key={card.label} className="rounded-md border bg-white p-3">
                  <p className="text-xs text-slate-600">{card.label}</p>
                  <p className="mt-1 text-lg font-semibold">{card.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 rounded-md border bg-slate-50 p-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span>Status</span>
                <select
                  value={referralStatusFilter}
                  onChange={(event) => setReferralStatusFilter(event.target.value as ReferralStatus | "ALL")}
                  className="w-full rounded-md border px-3 py-2"
                >
                  {[
                    "ALL",
                    "SENT",
                    "CLICKED",
                    "ENQUIRED",
                    "SHORTLISTED",
                    "PLACED",
                    "REJECTED",
                    "EXPIRED",
                  ].map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Search student/code/provider/listing</span>
                <input
                  value={referralSearch}
                  onChange={(event) => setReferralSearch(event.target.value)}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="Search..."
                />
              </label>
            </div>

            {referralsError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{referralsError}</div>
            ) : null}

            {referralsLoading ? (
              <p className="text-sm text-slate-600">Loading referrals...</p>
            ) : referrals.length === 0 ? (
              <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-slate-600">No referrals found.</div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      {[
                        "Referral Code",
                        "Student",
                        "Provider",
                        "Listing",
                        "Status",
                        "Follow-ups",
                        "Commission Due",
                        "Created",
                        "Actions",
                      ].map((label) => (
                        <th key={label} className="px-4 py-3 font-medium">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {referrals.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 font-mono font-medium text-slate-900">{row.referralCode}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{row.student.name}</div>
                          <div className="text-xs text-slate-600">{row.student.email || "-"}</div>
                        </td>
                        <td className="px-4 py-3">{row.provider.name}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{row.listing.title}</div>
                          <div className="text-xs text-slate-600">{row.listing.city}, {row.listing.country}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${referralBadgeClass[row.status]}`}>{row.status}</span>
                        </td>
                        <td className="px-4 py-3">{row.followUpCount}{row.followUpSentAt ? ` (last ${new Date(row.followUpSentAt).toLocaleDateString()})` : ""}</td>
                        <td className="px-4 py-3">{row.commissionDue == null ? "-" : `GBP ${row.commissionDue.toFixed(2)}`}</td>
                        <td className="px-4 py-3">{new Date(row.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void runReferralAction(row, { action: "CHASE" })}
                              disabled={referralsUpdatingId === row.id}
                              className="rounded-md border px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              Chase
                            </button>
                            <button
                              type="button"
                              onClick={() => void runReferralAction(row, { action: "UPDATE", status: "PLACED" })}
                              disabled={referralsUpdatingId === row.id || row.status === "PLACED"}
                              className="rounded-md border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-60"
                            >
                              Mark Placed
                            </button>
                            <button
                              type="button"
                              onClick={() => void runReferralAction(row, { action: "UPDATE", status: "REJECTED" })}
                              disabled={referralsUpdatingId === row.id || row.status === "REJECTED"}
                              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                            >
                              Mark Rejected
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === "Commissions" ? (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-4">
              {[
                { label: "Total Earned", value: commissionsSummary.totalEarned },
                { label: "Pending", value: commissionsSummary.pending },
                { label: "Invoiced", value: commissionsSummary.invoiced },
                { label: "This Month", value: commissionsSummary.thisMonthEarned },
              ].map((card) => (
                <div key={card.label} className="rounded-md border bg-white p-4">
                  <p className="text-sm text-slate-600">{card.label}</p>
                  <p className="mt-2 text-xl font-semibold">GBP {card.value.toFixed(2)}</p>
                </div>
              ))}
            </div>

            {commissionsError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{commissionsError}</div>
            ) : null}

            {commissionsLoading ? (
              <p className="text-sm text-slate-600">Loading commissions...</p>
            ) : commissions.length === 0 ? (
              <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-slate-600">No commissions found.</div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      {[
                        "Provider",
                        "Student",
                        "Amount",
                        "Rate %",
                        "Status",
                        "Invoiced Date",
                        "Paid Date",
                        "Actions",
                      ].map((label) => (
                        <th key={label} className="px-4 py-3 font-medium">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {commissions.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">{item.provider.name}</td>
                        <td className="px-4 py-3">{item.studentName}</td>
                        <td className="px-4 py-3">{item.currency} {item.amount.toFixed(2)}</td>
                        <td className="px-4 py-3">{item.rate}%</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${commissionBadgeClass[item.status]}`}>{item.status}</span></td>
                        <td className="px-4 py-3">{item.invoicedAt ? new Date(item.invoicedAt).toLocaleDateString() : "-"}</td>
                        <td className="px-4 py-3">{item.paidAt ? new Date(item.paidAt).toLocaleDateString() : "-"}</td>
                        <td className="px-4 py-3">
                          {item.status === "PENDING" ? (
                            <button
                              type="button"
                              disabled={commissionsUpdatingId === item.id}
                              onClick={() => void updateCommissionStatus(item, "INVOICED")}
                              className="rounded-md border px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                            >
                              Mark as Invoiced
                            </button>
                          ) : item.status === "INVOICED" ? (
                            <button
                              type="button"
                              disabled={commissionsUpdatingId === item.id}
                              onClick={() => void updateCommissionStatus(item, "PAID")}
                              className="rounded-md border px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-60"
                            >
                              Mark as Paid
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">No action</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="space-y-4 rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">Service Pricing Management</h3>
                <button
                  type="button"
                  onClick={() => setAddPriceModalOpen(true)}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Add New Price
                </button>
              </div>

              {pricingError ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pricingError}</div> : null}

              {pricingLoading ? (
                <p className="text-sm text-slate-600">Loading pricing...</p>
              ) : pricing.length === 0 ? (
                <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-slate-600">No pricing rows found.</div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-slate-600">
                      <tr>
                        {["Name", "Airport", "Amount", "Currency", "Active", "Actions"].map((label) => (
                          <th key={label} className="px-4 py-3 font-medium">{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {pricing.map((row) => (
                        <tr key={row.id}>
                          <td className="px-4 py-3">
                            {pricingEditingId === row.id ? (
                              <input value={pricingEditValues.name || ""} onChange={(event) => setPricingEditValues((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-md border px-2 py-1" />
                            ) : (
                              row.name
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {pricingEditingId === row.id ? (
                              <input value={pricingEditValues.airport || ""} onChange={(event) => setPricingEditValues((current) => ({ ...current, airport: event.target.value }))} className="w-full rounded-md border px-2 py-1" />
                            ) : (
                              row.airport || "-"
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {pricingEditingId === row.id ? (
                              <input type="number" step="0.01" value={pricingEditValues.amount || ""} onChange={(event) => setPricingEditValues((current) => ({ ...current, amount: event.target.value }))} className="w-full rounded-md border px-2 py-1" />
                            ) : (
                              row.amount
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {pricingEditingId === row.id ? (
                              <select value={pricingEditValues.currency || "GBP"} onChange={(event) => setPricingEditValues((current) => ({ ...current, currency: event.target.value as PricingForm["currency"] }))} className="w-full rounded-md border px-2 py-1"><option value="GBP">GBP</option><option value="USD">USD</option><option value="CAD">CAD</option><option value="AUD">AUD</option></select>
                            ) : (
                              row.currency
                            )}
                          </td>
                          <td className="px-4 py-3">{row.isActive ? "Yes" : "No"}</td>
                          <td className="px-4 py-3">
                            {pricingEditingId === row.id ? (
                              <div className="flex gap-2">
                                <button type="button" disabled={pricingSaving} onClick={() => void savePricingEdit(row.id)} className="rounded-md border px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50">Save</button>
                                <button type="button" onClick={() => setPricingEditingId(null)} className="rounded-md border px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => startPricingEdit(row)} className="rounded-md border px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Edit</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "Payments" ? (
          <ServicePaymentsTab
            currentUserId={session?.user?.id}
            onOpenPricingTab={() => setActiveTab("Commissions")}
          />
        ) : activeTab === "Airport Pickups" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Airport Pickups</h2>
              <div className="inline-flex rounded-md border p-1">
                <button
                  type="button"
                  onClick={() => setAirportView("table")}
                  className={`rounded px-3 py-1.5 text-sm ${airportView === "table" ? "bg-blue-600 text-white" : "text-slate-700"}`}
                >
                  Table View
                </button>
                <button
                  type="button"
                  onClick={() => setAirportView("calendar")}
                  className={`rounded px-3 py-1.5 text-sm ${airportView === "calendar" ? "bg-blue-600 text-white" : "text-slate-700"}`}
                >
                  Calendar View
                </button>
              </div>
            </div>

            <div className="grid gap-3 rounded-md border bg-slate-50 p-3 md:grid-cols-5">
              <label className="space-y-1 text-sm">
                <span>Status</span>
                <select
                  value={airportStatusFilter}
                  onChange={(event) => setAirportStatusFilter(event.target.value as (typeof airportStatusFilters)[number]["value"])}
                  className="w-full rounded-md border px-3 py-2"
                >
                  {airportStatusFilters.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Destination country</span>
                <input
                  value={airportDestinationFilter}
                  onChange={(event) => setAirportDestinationFilter(event.target.value)}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="Country"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>From date</span>
                <input type="date" value={airportFromDate} onChange={(event) => setAirportFromDate(event.target.value)} className="w-full rounded-md border px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm">
                <span>To date</span>
                <input type="date" value={airportToDate} onChange={(event) => setAirportToDate(event.target.value)} className="w-full rounded-md border px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm">
                <span>Search student name</span>
                <input
                  value={airportStudentSearch}
                  onChange={(event) => setAirportStudentSearch(event.target.value)}
                  className="w-full rounded-md border px-3 py-2"
                  placeholder="Student name"
                />
              </label>
            </div>

            {airportError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{airportError}</div>
            ) : null}

            {airportView === "table" ? (
              airportLoading ? (
                <p className="text-sm text-slate-600">Loading airport pickups...</p>
              ) : filteredAirportBookings.length === 0 ? (
                <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-slate-600">No airport pickup bookings found.</div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-slate-600">
                      <tr>
                        {[
                          "Student Name",
                          "Flight No",
                          "From City",
                          "To Airport",
                          "Arrival Date",
                          "Arrival Time",
                          "Passengers",
                          "Ticket",
                          "Payment",
                          "Status",
                          "Actions",
                        ].map((label) => (
                          <th key={label} className="px-4 py-3 font-medium">{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredAirportBookings.map((booking) => (
                        <tr key={booking.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openAirportDetail(booking)}>
                          <td className="px-4 py-3 font-medium text-slate-900">{booking.studentName}</td>
                          <td className="px-4 py-3">{booking.flightNumber}</td>
                          <td className="px-4 py-3">{booking.departureCity}</td>
                          <td className="px-4 py-3">{booking.airport}</td>
                          <td className="px-4 py-3">{new Date(booking.arrivalDate).toLocaleDateString()}</td>
                          <td className="px-4 py-3">{booking.arrivalTime}</td>
                          <td className="px-4 py-3">{booking.passengerCount}</td>
                          <td className="px-4 py-3">
                            {booking.ticketConfirmationUrl ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  window.open(booking.ticketConfirmationUrl!, "_blank", "noopener,noreferrer");
                                }}
                                className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white"
                              >
                                View
                              </button>
                            ) : (
                              <span className="text-xs text-slate-500">Not uploaded</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {booking.paymentStatus ? (
                              <span className={`rounded-full px-2 py-1 text-xs font-medium ${paymentBadgeClass[booking.paymentStatus]}`}>{booking.paymentStatus}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${airportStatusBadgeClass[booking.status]}`}>{booking.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                              {booking.ticketConfirmationUrl ? (
                                <button
                                  type="button"
                                  onClick={() => window.open(booking.ticketConfirmationUrl!, "_blank", "noopener,noreferrer")}
                                  className="rounded-md border px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  View Ticket
                                </button>
                              ) : null}
                              {booking.status === "PENDING" ? (
                                <button
                                  type="button"
                                  disabled={airportUpdatingId === booking.id}
                                  onClick={() => void confirmAirportBooking(booking)}
                                  className="rounded-md border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-60"
                                >
                                  Confirm Booking
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => openAddNoteModal(booking)}
                                className="rounded-md border px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Add Note
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <div className="space-y-3 rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setAirportCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    Previous
                  </button>
                  <p className="text-sm font-semibold">{airportCalendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
                  <button
                    type="button"
                    onClick={() => setAirportCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-slate-500">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="py-1">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {calendarCells.map((cell) => (
                    <div key={cell.date.toISOString()} className={`min-h-24 rounded-md border p-2 ${cell.inMonth ? "bg-white" : "bg-slate-50 text-slate-400"}`}>
                      <p className="text-xs font-medium">{cell.date.getDate()}</p>
                      <div className="mt-1 space-y-1">
                        {cell.items.slice(0, 3).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => openAirportDetail(item)}
                            className="block w-full truncate rounded bg-blue-50 px-1.5 py-0.5 text-left text-xs text-blue-700 hover:bg-blue-100"
                          >
                            {item.studentName}
                          </button>
                        ))}
                        {cell.items.length > 3 ? <p className="text-xs text-slate-500">+{cell.items.length - 3} more</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold">{activeTab}</h2>
            <p className="mt-2 text-slate-600">Coming soon</p>
            <button
              type="button"
              className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add
            </button>
          </>
        )}
      </section>

      {modalOpen ? (
        <AppModal maxWidthClass="max-w-3xl">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{editingProvider ? "Edit Provider" : "Add Provider"}</h3>
              <button type="button" onClick={closeModal} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm"><span>Provider name</span><input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
              <label className="space-y-1 text-sm"><span>Type</span><select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as Provider["type"] }))} className="w-full rounded-md border px-3 py-2">{providerTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label className="space-y-1 text-sm"><span>Website</span><input value={form.website} onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
              <label className="space-y-1 text-sm"><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
              <label className="space-y-1 text-sm"><span>Phone</span><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
              <label className="space-y-1 text-sm"><span>City</span><input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
              <label className="space-y-1 text-sm"><span>Country</span><input required value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
              <label className="space-y-1 text-sm"><span>Commission rate %</span><input type="number" min="0" max="100" step="0.01" value={form.commissionRate} onChange={(event) => setForm((current) => ({ ...current, commissionRate: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
              <label className="space-y-1 text-sm"><span>Contact person name</span><input value={form.contactPerson} onChange={(event) => setForm((current) => ({ ...current, contactPerson: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
              <label className="space-y-1 text-sm"><span>Contact person email</span><input type="email" value={form.contactEmail} onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
            </div>
            <label className="block space-y-1 text-sm"><span>Notes</span><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-28 w-full rounded-md border px-3 py-2" /></label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="rounded-md border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
            </div>
          </form>
        </AppModal>
      ) : null}

      {listingModalOpen ? (
        <AppModal maxWidthClass="max-w-4xl">
          {listingModalStep === "type" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">What type of listing?</h3>
                <button type="button" onClick={closeListingModal} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => chooseListingType("ACCOMMODATION")}
                  className="rounded-lg border px-6 py-8 text-left hover:bg-slate-50"
                >
                  <p className="text-lg font-semibold">Accommodation</p>
                  <p className="mt-1 text-sm text-slate-600">Create housing and rental listings.</p>
                </button>
                <button
                  type="button"
                  onClick={() => chooseListingType("JOB_INTERNSHIP")}
                  className="rounded-lg border px-6 py-8 text-left hover:bg-slate-50"
                >
                  <p className="text-lg font-semibold">Job</p>
                  <p className="mt-1 text-sm text-slate-600">Create jobs and internship listings.</p>
                </button>
              </div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submitListing}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">{editingListing ? "Edit Listing" : `Add ${listingForm.type === "ACCOMMODATION" ? "Accommodation" : "Job"} Listing`}</h3>
                <button type="button" onClick={closeListingModal} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
              </div>

              {listingForm.type === "ACCOMMODATION" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1 text-sm"><span>Title</span><input required value={listingForm.title} onChange={(event) => setListingForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span>Provider</span><select required value={listingForm.providerId} onChange={(event) => setListingForm((current) => ({ ...current, providerId: event.target.value }))} className="w-full rounded-md border px-3 py-2"><option value="">Select provider</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
                  <label className="space-y-1 text-sm"><span>City</span><input required value={listingForm.city} onChange={(event) => setListingForm((current) => ({ ...current, city: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span>Country</span><input required value={listingForm.country} onChange={(event) => setListingForm((current) => ({ ...current, country: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span>Price per month</span><input type="number" step="0.01" value={listingForm.price} onChange={(event) => setListingForm((current) => ({ ...current, price: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span>Currency</span><select value={listingForm.currency} onChange={(event) => setListingForm((current) => ({ ...current, currency: event.target.value }))} className="w-full rounded-md border px-3 py-2"><option value="GBP">GBP</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
                  <label className="space-y-1 text-sm"><span>Available from</span><input type="date" value={listingForm.availableFrom} onChange={(event) => setListingForm((current) => ({ ...current, availableFrom: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span>Available to</span><input type="date" value={listingForm.availableTo} onChange={(event) => setListingForm((current) => ({ ...current, availableTo: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span>Bedrooms</span><input type="number" min="0" value={listingForm.bedrooms} onChange={(event) => setListingForm((current) => ({ ...current, bedrooms: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span>Bathrooms</span><input type="number" min="0" value={listingForm.bathrooms} onChange={(event) => setListingForm((current) => ({ ...current, bathrooms: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
                  <div className="space-y-2 text-sm md:col-span-2">
                    <span className="font-medium">Amenities</span>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {amenityOptions.map((amenity) => (
                        <label key={amenity} className="flex items-center gap-2 rounded-md border px-3 py-2">
                          <input
                            type="checkbox"
                            checked={listingForm.amenities.includes(amenity)}
                            onChange={(event) =>
                              setListingForm((current) => ({
                                ...current,
                                amenities: event.target.checked
                                  ? [...current.amenities, amenity]
                                  : current.amenities.filter((item) => item !== amenity),
                              }))
                            }
                          />
                          {amenity}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><input type="checkbox" checked={listingForm.isFullyFurnished} onChange={(event) => setListingForm((current) => ({ ...current, isFullyFurnished: event.target.checked }))} />Fully Furnished</label>
                  <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><input type="checkbox" checked={listingForm.isBillsIncluded} onChange={(event) => setListingForm((current) => ({ ...current, isBillsIncluded: event.target.checked }))} />Bills Included</label>
                  <label className="space-y-1 text-sm md:col-span-2"><span>Description</span><textarea value={listingForm.description} onChange={(event) => setListingForm((current) => ({ ...current, description: event.target.value }))} className="min-h-24 w-full rounded-md border px-3 py-2" /></label>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1 text-sm"><span>Job title</span><input required value={listingForm.jobTitle} onChange={(event) => setListingForm((current) => ({ ...current, jobTitle: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span>Provider</span><select required value={listingForm.providerId} onChange={(event) => setListingForm((current) => ({ ...current, providerId: event.target.value }))} className="w-full rounded-md border px-3 py-2"><option value="">Select provider</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
                  <label className="space-y-1 text-sm"><span>Job type</span><select value={listingForm.jobType} onChange={(event) => setListingForm((current) => ({ ...current, jobType: event.target.value }))} className="w-full rounded-md border px-3 py-2">{jobTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                  <label className="space-y-1 text-sm"><span>Sector</span><select value={listingForm.jobSector} onChange={(event) => setListingForm((current) => ({ ...current, jobSector: event.target.value }))} className="w-full rounded-md border px-3 py-2">{jobSectorOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                  <label className="space-y-1 text-sm"><span>City</span><input required value={listingForm.city} onChange={(event) => setListingForm((current) => ({ ...current, city: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span>Country</span><input required value={listingForm.country} onChange={(event) => setListingForm((current) => ({ ...current, country: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span>Salary min</span><input type="number" step="0.01" value={listingForm.salaryMin} onChange={(event) => setListingForm((current) => ({ ...current, salaryMin: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span>Salary max</span><input type="number" step="0.01" value={listingForm.salaryMax} onChange={(event) => setListingForm((current) => ({ ...current, salaryMax: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span>Hours per week</span><input type="number" min="1" value={listingForm.hoursPerWeek} onChange={(event) => setListingForm((current) => ({ ...current, hoursPerWeek: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span>Application deadline</span><input type="date" value={listingForm.applicationDeadline} onChange={(event) => setListingForm((current) => ({ ...current, applicationDeadline: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
                  <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm md:col-span-2"><input type="checkbox" checked={listingForm.isRemote} onChange={(event) => setListingForm((current) => ({ ...current, isRemote: event.target.checked }))} />Remote</label>
                  <label className="space-y-1 text-sm md:col-span-2"><span>Description</span><textarea value={listingForm.description} onChange={(event) => setListingForm((current) => ({ ...current, description: event.target.value }))} className="min-h-24 w-full rounded-md border px-3 py-2" /></label>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeListingModal} className="rounded-md border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={listingSaving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{listingSaving ? "Saving..." : "Save"}</button>
              </div>
            </form>
          )}
        </AppModal>
      ) : null}

      {applicationModalOpen && selectedApplication ? (
        <AppModal maxWidthClass="max-w-2xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Application Details</h3>
              <button type="button" onClick={() => setApplicationModalOpen(false)} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
            </div>
            <div className="grid gap-3 rounded-md border bg-slate-50 p-3 text-sm md:grid-cols-2">
              <p><span className="font-medium">Student:</span> {selectedApplication.studentName}</p>
              <p><span className="font-medium">Email:</span> {selectedApplication.studentEmail || "-"}</p>
              <p><span className="font-medium">Listing:</span> {selectedApplication.listingTitle}</p>
              <p><span className="font-medium">Provider:</span> {selectedApplication.providerName}</p>
            </div>

            <label className="space-y-1 text-sm">
              <span>Application status</span>
              <select value={applicationEditStatus} onChange={(event) => setApplicationEditStatus(event.target.value as ApplicationStatus)} className="w-full rounded-md border px-3 py-2">
                {applicationStatuses.filter((option) => option.value !== "ALL").map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span>Student note</span>
              <textarea readOnly value={selectedApplication.studentNote || ""} className="min-h-20 w-full rounded-md border bg-slate-100 px-3 py-2" />
            </label>

            <label className="space-y-1 text-sm">
              <span>Admin note</span>
              <textarea value={applicationEditAdminNote} onChange={(event) => setApplicationEditAdminNote(event.target.value)} className="min-h-24 w-full rounded-md border px-3 py-2" />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setApplicationPlacementConfirmed(true)}
                className="rounded-md border border-green-200 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
              >
                Mark Placement Confirmed
              </button>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${applicationPlacementConfirmed ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-700"}`}>
                {applicationPlacementConfirmed ? "Confirmed" : "Not confirmed"}
              </span>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setApplicationModalOpen(false)} className="rounded-md border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={() => void saveApplication()} disabled={applicationSaving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">{applicationSaving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </AppModal>
      ) : null}

      {addPriceModalOpen ? (
        <AppModal maxWidthClass="max-w-xl">
          <form className="space-y-4" onSubmit={saveNewPrice}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Add New Price</h3>
              <button type="button" onClick={() => setAddPriceModalOpen(false)} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm"><span>Service type</span><select value={newPriceForm.serviceType} onChange={(event) => setNewPriceForm((current) => ({ ...current, serviceType: event.target.value as PricingForm["serviceType"] }))} className="w-full rounded-md border px-3 py-2"><option value="AIRPORT_PICKUP">Airport Pickup</option><option value="ACCOMMODATION_DEPOSIT">Accommodation Deposit</option><option value="PRE_DEPARTURE_EVENT">Pre-Departure Event</option><option value="OTHER_SERVICE">Other Service</option></select></label>
              <label className="space-y-1 text-sm"><span>Name</span><input required value={newPriceForm.name} onChange={(event) => setNewPriceForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
              <label className="space-y-1 text-sm"><span>Airport or location</span><input value={newPriceForm.airport} onChange={(event) => setNewPriceForm((current) => ({ ...current, airport: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
              <label className="space-y-1 text-sm"><span>Amount</span><input required type="number" min="0" step="0.01" value={newPriceForm.amount} onChange={(event) => setNewPriceForm((current) => ({ ...current, amount: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
              <label className="space-y-1 text-sm"><span>Currency</span><select value={newPriceForm.currency} onChange={(event) => setNewPriceForm((current) => ({ ...current, currency: event.target.value as PricingForm["currency"] }))} className="w-full rounded-md border px-3 py-2"><option value="GBP">GBP</option><option value="USD">USD</option><option value="CAD">CAD</option><option value="AUD">AUD</option></select></label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAddPriceModalOpen(false)} className="rounded-md border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={pricingSaving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">{pricingSaving ? "Saving..." : "Save"}</button>
            </div>
          </form>
        </AppModal>
      ) : null}

      {airportNoteModalOpen && airportNoteBooking ? (
        <AppModal maxWidthClass="max-w-lg">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Add Admin Note</h3>
              <button type="button" onClick={() => setAirportNoteModalOpen(false)} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
            </div>
            <textarea
              value={airportNoteText}
              onChange={(event) => setAirportNoteText(event.target.value)}
              className="min-h-28 w-full rounded-md border px-3 py-2"
              placeholder="Write note..."
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAirportNoteModalOpen(false)} className="rounded-md border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" disabled={airportUpdatingId === airportNoteBooking.id} onClick={() => void saveAirportNote()} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">Save</button>
            </div>
          </div>
        </AppModal>
      ) : null}

      {airportModalOpen && selectedBooking ? (
        <AppModal maxWidthClass="max-w-3xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Airport Booking Detail</h3>
              <button type="button" onClick={() => setAirportModalOpen(false)} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
            </div>

            <div className="grid gap-3 rounded-md border bg-slate-50 p-3 text-sm md:grid-cols-2">
              <p><span className="font-medium">Student:</span> {selectedBooking.studentName}</p>
              <p><span className="font-medium">Contact:</span> {selectedBooking.studentEmail || "-"}{selectedBooking.studentPhone ? ` / ${selectedBooking.studentPhone}` : ""}</p>
              <p><span className="font-medium">Flight no:</span> {selectedBooking.flightNumber}</p>
              <p><span className="font-medium">Passengers:</span> {selectedBooking.passengerCount}</p>
            </div>

            <div className="grid gap-3 rounded-md border p-3 text-sm md:grid-cols-2">
              <p><span className="font-medium">Departure:</span> {selectedBooking.departureCity}, {selectedBooking.departureCountry}</p>
              <p><span className="font-medium">Departure date/time:</span> {new Date(selectedBooking.departureDate).toLocaleDateString()} {selectedBooking.departureTime}</p>
              <p><span className="font-medium">Arrival:</span> {selectedBooking.airport}{selectedBooking.terminal ? ` (T${selectedBooking.terminal})` : ""}, {selectedBooking.destinationCity}, {selectedBooking.destinationCountry}</p>
              <p><span className="font-medium">Arrival date/time:</span> {new Date(selectedBooking.arrivalDate).toLocaleDateString()} {selectedBooking.arrivalTime}</p>
              <p className="md:col-span-2"><span className="font-medium">Special requirements:</span> {selectedBooking.specialRequirements || "-"}</p>
            </div>

            <div className="grid gap-3 rounded-md border p-3 text-sm md:grid-cols-2">
              <p>
                <span className="font-medium">Ticket:</span>{" "}
                {selectedBooking.ticketConfirmationUrl ? (
                  <button type="button" className="text-blue-700 underline" onClick={() => window.open(selectedBooking.ticketConfirmationUrl!, "_blank", "noopener,noreferrer")}>View Ticket</button>
                ) : (
                  "Not uploaded"
                )}
              </p>
              <p>
                <span className="font-medium">Payment status:</span>{" "}
                {selectedBooking.paymentStatus ? (
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${paymentBadgeClass[selectedBooking.paymentStatus]}`}>{selectedBooking.paymentStatus}</span>
                ) : (
                  <span className="text-slate-500">-</span>
                )}
              </p>
              <p className="md:col-span-2">
                <span className="font-medium">Payment proof:</span>{" "}
                {selectedBooking.paymentProofUrl ? (
                  <button type="button" className="text-blue-700 underline" onClick={() => window.open(selectedBooking.paymentProofUrl!, "_blank", "noopener,noreferrer")}>{selectedBooking.paymentProofName || "View payment proof"}</button>
                ) : (
                  "-"
                )}
              </p>
            </div>

            <label className="space-y-1 text-sm">
              <span>Admin note</span>
              <textarea value={airportModalAdminNote} onChange={(event) => setAirportModalAdminNote(event.target.value)} className="min-h-24 w-full rounded-md border px-3 py-2" />
            </label>

            <label className="space-y-1 text-sm">
              <span>Status</span>
              <select value={airportModalStatus} onChange={(event) => setAirportModalStatus(event.target.value as AirportPickupStatus)} className="w-full rounded-md border px-3 py-2">
                {airportStatusFilters.filter((option) => option.value !== "ALL").map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span>Cancel reason</span>
              <input value={airportCancelReason} onChange={(event) => setAirportCancelReason(event.target.value)} className="w-full rounded-md border px-3 py-2" placeholder="Add reason if cancelling" />
            </label>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={airportUpdatingId === selectedBooking.id}
                onClick={() => void updateAirportBooking(selectedBooking, { status: "CONFIRMED", adminNote: airportModalAdminNote || null })}
                className="rounded-md border border-green-200 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-60"
              >
                Confirm
              </button>
              <button
                type="button"
                disabled={airportUpdatingId === selectedBooking.id}
                onClick={() => void cancelAirportFromModal()}
                className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={airportUpdatingId === selectedBooking.id}
                onClick={() => void saveAirportModal()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </div>
        </AppModal>
      ) : null}
    </main>
  );
}
