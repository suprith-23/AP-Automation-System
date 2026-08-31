import apiClient from "./api-client";
import invoiceService from "./invoice.service";
import purchaseOrderService from "./purchase-order.service";
import userService, { UserResponse as UserServiceUserResponse } from "./user.service";
import settingsService from "./settings.service";
import promptService from "./prompt.service";
import auditService from "./audit.service";

export type UserResponse = UserServiceUserResponse;

export const getInvoices = invoiceService.getInvoices;
export const getDashboardStats = invoiceService.getDashboardStats;
export const getReviewerQueue = invoiceService.getReviewerQueue;
export const getApproverQueue = invoiceService.getApproverQueue;
export const getInvoiceById = invoiceService.getInvoiceById;
export const updateInvoice = invoiceService.updateInvoice;
export const uploadInvoiceDocument = invoiceService.uploadInvoiceDocument;
export const submitInvoiceForApproval = invoiceService.submitInvoiceForApproval;
export const rejectInvoice = invoiceService.rejectInvoice;
export const approveInvoice = invoiceService.approveInvoice;
export const matchInvoice = invoiceService.matchInvoice;
export const deleteInvoice = invoiceService.deleteInvoice;
export const reprocessInvoice = invoiceService.reprocessInvoice;
export const reopenInvoice = invoiceService.reopenInvoice;
export const downloadDocument = invoiceService.downloadDocument;
export const releaseInvoiceForPayment = invoiceService.releaseInvoiceForPayment;
export const confirmInvoicePayment = invoiceService.confirmInvoicePayment;
export const updateInvoiceFields = invoiceService.updateInvoiceFields;
export const getInvoiceComments = invoiceService.getInvoiceComments;
export const postInvoiceComment = invoiceService.postInvoiceComment;

export const getPurchaseOrders = purchaseOrderService.getPurchaseOrders;
export const createPurchaseOrder = purchaseOrderService.createPurchaseOrder;
export const updatePurchaseOrder = purchaseOrderService.updatePurchaseOrder;
export const deletePurchaseOrder = purchaseOrderService.deletePurchaseOrder;

export const getUsers = userService.getUsers;
export const createUser = userService.createUser;
export const updateUser = userService.updateUser;
export const deleteUser = userService.deleteUser;

export const getSettings = settingsService.getSettings;
export const updateSettings = settingsService.updateSettings;
export const getGstConfig = settingsService.getGstConfig;
export const updateGstConfig = settingsService.updateGstConfig;
export { gstHsnRuleService } from "./settings.service";

export const getPrompts = promptService.getPrompts;
export const createPrompt = promptService.createPrompt;
export const updatePrompt = promptService.updatePrompt;
export const activatePrompt = promptService.activatePrompt;
export const deletePrompt = promptService.deletePrompt;
export const testPrompt = promptService.testPrompt;

export const getInvoiceAuditLogs = auditService.getInvoiceAuditLogs;
export const getAllAuditLogs = auditService.getAllAuditLogs;

export { aiProviderService } from "./ai-provider.service";
export type { AIProviderConfig } from "./ai-provider.service";

export { default as enterpriseService } from "./enterprise.service";
export { default as vendorService } from "./vendor.service";
export default apiClient;

