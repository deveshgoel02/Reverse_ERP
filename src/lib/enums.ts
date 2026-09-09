/**
 * Central source of truth for every "enum-like" string field in the Prisma
 * schema. The schema uses plain String columns (see prisma/schema.prisma
 * header for why), so these Zod enums are what actually enforce valid
 * values at the application boundary, and what the rest of the app imports
 * for switch/case exhaustiveness instead of retyping string literals.
 */
import { z } from "zod";

export const UserRole = ["OWNER", "MANAGER", "STAFF", "VIEWER"] as const;
export const userRoleSchema = z.enum(UserRole);
export type UserRole = z.infer<typeof userRoleSchema>;

export const Gender = ["MEN", "WOMEN", "UNISEX", "KIDS"] as const;
export const genderSchema = z.enum(Gender);
export type Gender = z.infer<typeof genderSchema>;

export const ProductStatus = ["ACTIVE", "DISCONTINUED", "MERGED"] as const;
export const productStatusSchema = z.enum(ProductStatus);
export type ProductStatus = z.infer<typeof productStatusSchema>;

/** Stock classification — see src/lib/analytics/classify.ts for the rules. */
export const StockStatus = [
  "HEALTHY",
  "FAST_MOVING",
  "NORMAL",
  "SLOW_MOVING",
  "AT_RISK",
  "DEAD_STOCK",
  "OVERSTOCKED",
  "UNDERSTOCKED",
  "OUT_OF_STOCK",
] as const;
export const stockStatusSchema = z.enum(StockStatus);
export type StockStatus = z.infer<typeof stockStatusSchema>;

export const MovementType = [
  "OPENING",
  "PURCHASE_RECEIPT",
  "SALE",
  "RETURN_IN",
  "RETURN_OUT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "DAMAGE",
  "ADJUSTMENT",
] as const;
export const movementTypeSchema = z.enum(MovementType);
export type MovementType = z.infer<typeof movementTypeSchema>;

export const PurchaseStatus = [
  "PENDING",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
] as const;
export const purchaseStatusSchema = z.enum(PurchaseStatus);
export type PurchaseStatus = z.infer<typeof purchaseStatusSchema>;

export const DeadlinePriority = ["LOW", "NORMAL", "HIGH"] as const;
export const deadlinePrioritySchema = z.enum(DeadlinePriority);
export type DeadlinePriority = z.infer<typeof deadlinePrioritySchema>;

export const DeadlineStatus = ["OPEN", "MET", "MISSED", "CANCELLED"] as const;
export const deadlineStatusSchema = z.enum(DeadlineStatus);
export type DeadlineStatus = z.infer<typeof deadlineStatusSchema>;

export const ImportEntityType = [
  "SALES",
  "PURCHASES",
  "INVENTORY",
  "PRODUCTS",
  "CUSTOMERS",
  "SUPPLIERS",
] as const;
export const importEntityTypeSchema = z.enum(ImportEntityType);
export type ImportEntityType = z.infer<typeof importEntityTypeSchema>;

export const ImportStatus = [
  "UPLOADED",
  "MAPPED",
  "VALIDATED",
  "IMPORTED",
  "FAILED",
] as const;
export const importStatusSchema = z.enum(ImportStatus);
export type ImportStatus = z.infer<typeof importStatusSchema>;

export const ImportRowStatus = [
  "PENDING",
  "VALID",
  "WARNING",
  "REJECTED",
  "IMPORTED",
] as const;
export const importRowStatusSchema = z.enum(ImportRowStatus);
export type ImportRowStatus = z.infer<typeof importRowStatusSchema>;

export const DataQualityIssueType = [
  "DUPLICATE",
  "MISSING_SKU",
  "MISSING_BRAND",
  "INVALID_DATE",
  "NEGATIVE_QUANTITY",
  "DUPLICATE_INVOICE",
  "INCONSISTENT_NAME",
  "SUSPICIOUS_VALUE",
  "MISSING_PERIOD",
  "OTHER",
] as const;
export const dataQualityIssueTypeSchema = z.enum(DataQualityIssueType);
export type DataQualityIssueType = z.infer<typeof dataQualityIssueTypeSchema>;

export const Severity = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const severitySchema = z.enum(Severity);
export type Severity = z.infer<typeof severitySchema>;

export const IssueStatus = ["OPEN", "RESOLVED", "IGNORED"] as const;
export const issueStatusSchema = z.enum(IssueStatus);
export type IssueStatus = z.infer<typeof issueStatusSchema>;

export const MatchSuggestionStatus = ["PENDING", "CONFIRMED", "REJECTED"] as const;
export const matchSuggestionStatusSchema = z.enum(MatchSuggestionStatus);
export type MatchSuggestionStatus = z.infer<typeof matchSuggestionStatusSchema>;

export const ForecastMethod = [
  "MOVING_AVERAGE",
  "WEIGHTED_MOVING_AVERAGE",
  "EXPONENTIAL_SMOOTHING",
  "LINEAR_REGRESSION",
  "SEASONAL_NAIVE",
  "INSUFFICIENT_DATA",
] as const;
export const forecastMethodSchema = z.enum(ForecastMethod);
export type ForecastMethod = z.infer<typeof forecastMethodSchema>;

export const Trend = ["INCREASING", "DECREASING", "STABLE", "SEASONAL", "UNKNOWN"] as const;
export const trendSchema = z.enum(Trend);
export type Trend = z.infer<typeof trendSchema>;

export const Confidence = ["HIGH", "MEDIUM", "LOW"] as const;
export const confidenceSchema = z.enum(Confidence);
export type Confidence = z.infer<typeof confidenceSchema>;

export const RecommendationType = [
  "ORDER_MORE",
  "ORDER_LESS",
  "MAINTAIN",
  "DO_NOT_ORDER",
  "REVIEW_MANUALLY",
] as const;
export const recommendationTypeSchema = z.enum(RecommendationType);
export type RecommendationType = z.infer<typeof recommendationTypeSchema>;

export const RecommendationStatus = ["PENDING", "ACCEPTED", "REJECTED", "MODIFIED", "SUPERSEDED"] as const;
export const recommendationStatusSchema = z.enum(RecommendationStatus);
export type RecommendationStatus = z.infer<typeof recommendationStatusSchema>;

export const AlertType = [
  "LOW_STOCK",
  "OVERSTOCK",
  "DEAD_STOCK",
  "AGING",
  "DEADLINE_APPROACHING",
  "DEADLINE_MISSED",
  "SALES_DECLINE",
  "SALES_SPIKE",
  "SUPPLIER_DELAY",
  "FORECAST_SHORTAGE",
  "HIGH_EXPOSURE",
] as const;
export const alertTypeSchema = z.enum(AlertType);
export type AlertType = z.infer<typeof alertTypeSchema>;

export const AlertStatus = ["OPEN", "ACKNOWLEDGED", "DISMISSED"] as const;
export const alertStatusSchema = z.enum(AlertStatus);
export type AlertStatus = z.infer<typeof alertStatusSchema>;

export const AuditAction = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "IMPORT",
  "MERGE",
  "ADJUST",
  "RECOMMENDATION_DECISION",
  "ALERT_DISMISS",
] as const;
export const auditActionSchema = z.enum(AuditAction);
export type AuditAction = z.infer<typeof auditActionSchema>;

export const SettingScopeType = ["BUSINESS", "BRAND", "CATEGORY"] as const;
export const settingScopeTypeSchema = z.enum(SettingScopeType);
export type SettingScopeType = z.infer<typeof settingScopeTypeSchema>;
