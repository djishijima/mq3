

import { supabase } from './supabaseClient.ts';
import { AuthUser } from '@supabase/supabase-js';
import {
    EmployeeUser,
    Job,
    Customer,
    JournalEntry,
    User,
    AccountItem,
    Lead,
    ApprovalRoute,
    PurchaseOrder,
    InventoryItem,
    Employee,
    Toast,
    ConfirmationDialogProps,
    BugReport,
    Estimate,
    ApplicationWithDetails,
    Application,
    Invoice,
    InboxItem,
    InvoiceData,
    InboxItemStatus,
    ApplicationCode,
    BugReportStatus,
    ManufacturingStatus,
    InvoiceItem,
    EstimateItem, // Keep for LeadProposalPackage
    EstimateStatus,
    MasterAccountItem,
    PaymentRecipient,
    Department,
    InvoiceStatus,
    LeadStatus,
    AllocationDivision,
    Title,
    UUID, // NEW
    PostalInfo, // NEW
    TrackingInfo, // NEW
    PostalStatus, // NEW
    MailOpenStatus, // NEW
    EstimateLineItem, // NEW
    Project,
    ProjectAttachment, // NEW
    AnalysisHistory
} from '../types.ts';
import { v4 as uuidv4 } from 'uuid'; // NEW

// calcTotalsはEstimateLineItem[]を受け取り、EstimateLineItem[]を返すように修正
function calcTotals(items: EstimateLineItem[], taxInclusive: boolean) {
  let subtotal = 0;
  let taxTotal = 0;
  const normalized = items.map((it) => {
    const sub = it.qty * it.unitPrice;
    const rate = it.taxRate ?? 0.1;
    const tax = taxInclusive ? Math.round(sub - sub / (1 + rate)) : Math.round(sub * rate);
    const total = taxInclusive ? sub : sub + tax;
    return { ...it, subtotal: sub, taxAmount: tax, total };
  });
  normalized.forEach((n) => {
    subtotal += n.subtotal ?? 0;
    taxTotal += n.taxAmount ?? 0;
  });
  const grandTotal = taxInclusive ? Math.round(subtotal) : Math.round(subtotal + taxTotal);
  return { items: normalized, subtotal, taxTotal, grandTotal };
}

// Mappers from snake_case (DB) to camelCase (JS)
const dbJobToJob = (dbJob: any): Job => ({
    id: dbJob.id,
    jobNumber: dbJob.job_number,
    clientName: dbJob.client_name,
    title: dbJob.title,
    status: dbJob.status,
    dueDate: dbJob.due_date,
    quantity: dbJob.quantity,
    paperType: dbJob.paper_type,
    finishing: dbJob.finishing,
    details: dbJob.details,
    createdAt: dbJob.created_at,
    price: dbJob.price,
    variableCost: dbJob.variable_cost,
    invoiceStatus: dbJob.invoice_status,
    invoicedAt: dbJob.invoiced_at,
    paidAt: dbJob.paid_at,
    readyToInvoice: dbJob.ready_to_invoice,
    invoiceId: dbJob.invoice_id,
    manufacturingStatus: dbJob.manufacturing_status,
    projectId: dbJob.project_id, // New
    projectName: dbJob.project_name, // New
    userId: dbJob.user_id,
});

const jobToDbJob = (job: Partial<Job>): any => ({
    job_number: job.jobNumber,
    client_name: job.clientName,
    title: job.title,
    status: job.status,
    due_date: job.dueDate,
    quantity: job.quantity,
    paper_type: job.paperType,
    finishing: job.finishing,
    details: job.details,
    price: job.price,
    variable_cost: job.variableCost,
    invoice_status: job.invoiceStatus,
    invoiced_at: job.invoicedAt,
    paid_at: job.paidAt,
    ready_to_invoice: job.readyToInvoice,
    invoice_id: job.invoiceId,
    manufacturing_status: job.manufacturingStatus,
    project_id: job.projectId, // New
    project_name: job.projectName, // New
    user_id: job.userId,
});

const dbCustomerToCustomer = (dbCustomer: any): Customer => ({
    id: dbCustomer.id,
    customerCode: dbCustomer.customer_code,
    customerName: dbCustomer.customer_name,
    customerNameKana: dbCustomer.customer_name_kana,
    representative: dbCustomer.representative,
    phoneNumber: dbCustomer.phone_number,
    address1: dbCustomer.address_1,
    companyContent: dbCustomer.company_content,
    annualSales: dbCustomer.annual_sales,
    employeesCount: dbCustomer.employees_count,
    note: dbCustomer.note,
    infoSalesActivity: dbCustomer.info_sales_activity,
    infoRequirements: dbCustomer.info_requirements,
    infoHistory: dbCustomer.info_history,
    createdAt: dbCustomer.created_at,
    postNo: dbCustomer.post_no,
    address2: dbCustomer.address_2,
    fax: dbCustomer.fax,
    closingDay: dbCustomer.closing_day,
    monthlyPlan: dbCustomer.monthly_plan,
    payDay: dbCustomer.pay_day,
    recoveryMethod: dbCustomer.recovery_method,
    userId: dbCustomer.user_id,
    name2: dbCustomer.name2,
    websiteUrl: dbCustomer.website_url,
    zipCode: dbCustomer.zip_code,
    foundationDate: dbCustomer.foundation_date,
    capital: dbCustomer.capital,
    customerRank: dbCustomer.customer_rank,
    customerDivision: dbCustomer.customer_division,
    salesType: dbCustomer.sales_type,
    creditLimit: dbCustomer.credit_limit,
    payMoney: dbCustomer.pay_money,
    bankName: dbCustomer.bank_name,
    branchName: dbCustomer.branch_name,
    accountNo: dbCustomer.account_no,
    salesUserCode: dbCustomer.sales_user_code,
    startDate: dbCustomer.start_date,
    endDate: dbCustomer.end_date,
    drawingDate: dbCustomer.drawing_date,
    salesGoal: dbCustomer.sales_goal,
    infoSalesIdeas: dbCustomer.info_sales_ideas,
    customerContactInfo: dbCustomer.customer_contact_info,
    aiAnalysis: dbCustomer.ai_analysis,
});

const customerToDbCustomer = (customer: Partial<Customer>): any => {
    const dbData: { [key: string]: any } = {};
    for (const key in customer) {
        const camelKey = key as keyof Customer;
        const snakeKey = camelKey.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        dbData[snakeKey] = customer[camelKey];
    }
    return dbData;
};

const dbProjectAttachmentToProjectAttachment = (att: any): ProjectAttachment => ({
    id: att.id,
    projectId: att.project_id,
    fileName: att.file_name,
    filePath: att.file_path,
    fileUrl: supabase.storage.from('project_files').getPublicUrl(att.file_path).data.publicUrl,
    mimeType: att.mime_type,
    category: att.category,
    createdAt: att.created_at,
});

const dbProjectToProject = (p: any): Project => ({
    id: p.id,
    projectName: p.project_name,
    customerName: p.customer_name,
    customerId: p.customer_id,
    status: p.status,
    overview: p.overview,
    extracted_details: p.extracted_details,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    userId: p.user_id,
    attachments: (p.attachments || []).map(dbProjectAttachmentToProjectAttachment),
    relatedEstimates: p.relatedEstimates, 
    relatedJobs: p.relatedJobs,
});


const dbLeadToLead = (dbLead: any): Lead => ({
    id: dbLead.id,
    status: dbLead.status,
    createdAt: dbLead.created_at,
    name: dbLead.name,
    email: dbLead.email,
    phone: dbLead.phone,
    company: dbLead.company,
    source: dbLead.source,
    tags: dbLead.tags,
    message: dbLead.message,
    updatedAt: dbLead.updated_at,
    referrer: dbLead.referrer,
    referrerUrl: dbLead.referrer_url,
    landingPageUrl: dbLead.landing_page_url,
    searchKeywords: dbLead.search_keywords,
    utmSource: dbLead.utm_source,
    utmMedium: dbLead.utm_medium,
    utmCampaign: dbLead.utm_campaign,
    utmTerm: dbLead.utm_term,
    utmContent: dbLead.utm_content,
    userAgent: dbLead.user_agent,
    ipAddress: dbLead.ip_address,
    deviceType: dbLead.device_type,
    browserName: dbLead.browser_name,
    osName: dbLead.os_name,
    country: dbLead.country,
    city: dbLead.city,
    region: dbLead.region,
    employees: dbLead.employees,
    budget: dbLead.budget,
    timeline: dbLead.timeline,
    inquiryType: dbLead.inquiry_type,
    inquiryTypes: dbLead.inquiry_types,
    infoSalesActivity: dbLead.info_sales_activity,
    score: dbLead.score,
    aiAnalysisReport: dbLead.ai_analysis_report,
    aiDraftProposal: dbLead.ai_draft_proposal,
    aiInvestigation: dbLead.ai_investigation ? { summary: dbLead.ai_investigation.summary, sources: dbLead.ai_investigation.sources } : undefined,
});

const leadToDbLead = (lead: Partial<Lead>): any => {
    const dbData: { [key: string]: any } = {};
    for (const key in lead) {
        const camelKey = key as keyof Lead;
        const snakeKey = camelKey.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        dbData[snakeKey] = lead[camelKey];
    }
    return dbData;
};

const dbBugReportToBugReport = (dbReport: any): BugReport => ({
    id: dbReport.id,
    reporterName: dbReport.reporter_name,
    reportType: dbReport.report_type,
    summary: dbReport.summary,
    description: dbReport.description,
    status: dbReport.status,
    createdAt: dbReport.created_at,
});

const bugReportToDbBugReport = (report: Partial<BugReport>): any => ({
    reporter_name: report.reporterName,
    report_type: report.reportType,
    summary: report.summary,
    description: report.description,
    status: report.status,
});

const dbApplicationCodeToApplicationCode = (d: any): ApplicationCode => ({
    id: d.id,
    code: d.code,
    name: d.name,
    description: d.description,
    createdAt: d.created_at,
});

const dbApprovalRouteToApprovalRoute = (d: any): ApprovalRoute => ({
    id: d.id,
    name: d.name,
    routeData: {
        steps: (d.route_data?.steps || []).map((s: any) => ({
            approverId: s.approver_id,
        })),
    },
    createdAt: d.created_at,
});

// Mappers for Estimate (UPDATED)
const dbEstimateToEstimate = (dbEstimate: any): Estimate => ({
    id: dbEstimate.id as UUID,
    estimateNumber: dbEstimate.estimate_number,
    customerName: dbEstimate.customer_name,
    title: dbEstimate.title,
    items: dbEstimate.items, // JSONB field, no key transformation needed
    subtotal: dbEstimate.subtotal,
    taxTotal: dbEstimate.tax_total,
    grandTotal: dbEstimate.grand_total,
    // total: dbEstimate.total, // Removed as per type definition update
    deliveryDate: dbEstimate.delivery_date,
    paymentTerms: dbEstimate.payment_terms,
    deliveryTerms: dbEstimate.delivery_terms, // Added
    deliveryMethod: dbEstimate.delivery_method,
    notes: dbEstimate.notes,
    status: dbEstimate.status,
    version: dbEstimate.version,
    userId: dbEstimate.user_id,
    user: dbEstimate.user, // Assuming user is joined if needed
    createdAt: dbEstimate.created_at,
    updatedAt: dbEstimate.updated_at,
    projectId: dbEstimate.project_id, // New
    projectName: dbEstimate.project_name, // New
    // NEW tracking/postal fields
    taxInclusive: dbEstimate.tax_inclusive, // Added
    pdfUrl: dbEstimate.pdf_url,
    tracking: dbEstimate.tracking,
    postal: dbEstimate.postal,
});

// FIX: Bug where totals were always recalculated to 0 on partial updates without items.
// Now, totals are only calculated and included if 'items' are part of the update.
const estimateToDbEstimate = (estimate: Partial<Estimate>): any => {
    const dbData: { [key: string]: any } = {};

    // Only handle non-total-related fields in the loop
    for (const key in estimate) {
        if (['user', 'estimateNumber', 'id', 'createdAt', 'updatedAt', 'items', 'subtotal', 'taxTotal', 'grandTotal'].includes(key)) {
            continue; // Skip fields handled separately or not for DB
        }
        const camelKey = key as keyof Estimate;
        const snakeKey = camelKey.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        dbData[snakeKey] = estimate[camelKey];
    }

    // Only recalculate and add totals if 'items' is explicitly part of the update
    if (estimate.hasOwnProperty('items')) {
        const totals = calcTotals(estimate.items || [], estimate.taxInclusive || false);
        dbData['items'] = totals.items;
        dbData['subtotal'] = totals.subtotal;
        dbData['tax_total'] = totals.taxTotal;
        dbData['grand_total'] = totals.grandTotal;
    }

    return dbData;
};

const dbToAnalysisHistory = (dbHistory: any): AnalysisHistory => ({
    id: dbHistory.id,
    userId: dbHistory.user_id,
    viewpoint: dbHistory.viewpoint,
    dataSources: dbHistory.data_sources,
    result: dbHistory.result,
    createdAt: dbHistory.created_at,
});


export const isSupabaseUnavailableError = (error: any): boolean => {
    if (!error) return false;
    const message = typeof error === 'string' ? error : error.message || error.details || error.error_description;
    if (!message) return false;
    return /fetch failed/i.test(message) || /failed to fetch/i.test(message) || /network/i.test(message);
};

export const resolveUserSession = async (authUser: AuthUser): Promise<EmployeeUser> => {
    const { data: existingUser, error: selectError } = await supabase
        .from('v_employees_active')
        .select('user_id, name, department, title, email, role, can_use_anything_analysis, created_at')
        .eq('user_id', authUser.id)
        .single();

    if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = 0 rows
        throw new Error(`Failed to retrieve user profile: ${selectError.message}`);
    }

    if (existingUser) {
        return {
            id: existingUser.user_id,
            ...existingUser
        } as EmployeeUser;
    }

    // New user, create entries in users and employees
    const newUser = {
        id: authUser.id,
        name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'New User',
        email: authUser.email,
        role: 'user',
        can_use_anything_analysis: true, // Default to true for new users
    };

    const { error: usersInsertError } = await supabase.from('users').insert(newUser);
    if (usersInsertError) {
        throw new Error(`Failed to create new user profile: ${usersInsertError.message}`);
    }

    const newEmployee = {
        user_id: authUser.id,
        name: newUser.name,
    };

    const { error: employeesInsertError } = await supabase.from('employees').insert(newEmployee);
    if (employeesInsertError) {
        // Rollback user creation? For now just throw error.
        throw new Error(`Failed to create new employee profile: ${employeesInsertError.message}`);
    }

    const { data: freshlyCreatedUser, error: freshSelectError } = await supabase
        .from('v_employees_active')
        .select('user_id, name, department, title, email, role, can_use_anything_analysis, created_at')
        .eq('user_id', authUser.id)
        .single();
    
    if (freshSelectError) {
        throw new Error(`Failed to retrieve newly created user profile: ${freshSelectError.message}`);
    }

    return {
        id: freshlyCreatedUser.user_id,
        ...freshlyCreatedUser
    } as EmployeeUser;
};

// FIX: Export all necessary functions
export const getUsers = async (): Promise<EmployeeUser[]> => {
    const { data, error } = await supabase.from('v_employees_active').select('*');
    if (error) throw error;
    return data.map(d => ({ ...d, id: d.user_id }));
};

export const getJobs = async (): Promise<Job[]> => {
    const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(dbJobToJob);
};

export const getCustomers = async (): Promise<Customer[]> => {
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(dbCustomerToCustomer);
};

export const getJournalEntries = async (): Promise<JournalEntry[]> => {
    const { data, error } = await supabase.from('journal_entries').select('*').order('date', { ascending: false });
    if (error) throw error;
    return data;
};

export const getAccountItems = async (): Promise<AccountItem[]> => {
    const { data, error } = await supabase.from('account_items').select('*');
    if (error) throw error;
    return data.map(d => ({
        id: d.id,
        code: d.code,
        name: d.name,
        categoryCode: d.category_code,
        isActive: d.is_active,
        sortOrder: d.sort_order,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
    }));
};

export const getLeads = async (): Promise<Lead[]> => {
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(dbLeadToLead);
};

export const getApprovalRoutes = async (): Promise<ApprovalRoute[]> => {
    const { data, error } = await supabase.from('approval_routes').select('*');
    if (error) throw error;
    return data.map(dbApprovalRouteToApprovalRoute);
};

export const getPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
    const { data, error } = await supabase.from('purchase_orders').select('*').order('order_date', { ascending: false });
    if (error) throw error;
    return data.map(d => ({ ...d, unitPrice: d.unit_price, supplierName: d.supplier_name, orderDate: d.order_date, itemName: d.item_name }));
};

export const getInventoryItems = async (): Promise<InventoryItem[]> => {
    const { data, error } = await supabase.from('inventory_items').select('*');
    if (error) throw error;
    return data.map(d => ({ ...d, unitPrice: d.unit_price }));
};

export const getEmployees = async (): Promise<Employee[]> => {
    const { data, error } = await supabase.from('employees').select('*');
    if (error) throw error;
    return data.map(d => ({ ...d, hireDate: d.hire_date }));
};

export const getBugReports = async (): Promise<BugReport[]> => {
    const { data, error } = await supabase.from('bug_reports').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(dbBugReportToBugReport);
};

export const getEstimates = async (): Promise<Estimate[]> => {
    const { data, error } = await supabase.from('estimates').select('*, user:users(name)').order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(dbEstimateToEstimate);
};

export const getApplications = async (user: EmployeeUser | null): Promise<ApplicationWithDetails[]> => {
    if (!user || !user.id) {
        return [];
    }
    const { data, error } = await supabase
        .from('applications')
        .select(`
            *,
            applicant:users(name),
            applicationCode:application_codes(name),
            approvalRoute:approval_routes(name, route_data)
        `)
        .or(`applicant_id.eq.${user.id},approver_id.eq.${user.id}`);
    if (error) throw error;
    return data.map(d => ({
        ...d,
        applicant: d.applicant,
        applicationCode: d.applicationCode,
        approvalRoute: d.approvalRoute ? dbApprovalRouteToApprovalRoute(d.approvalRoute) : undefined,
    })) as ApplicationWithDetails[];
};

export const getApplicationCodes = async (): Promise<ApplicationCode[]> => {
    const { data, error } = await supabase.from('application_codes').select('*');
    if (error) throw error;
    return data.map(dbApplicationCodeToApplicationCode);
};

export const getInvoices = async (): Promise<Invoice[]> => {
    const { data, error } = await supabase.from('invoices').select('*, items:invoice_items(*)').order('invoice_date', { ascending: false });
    if (error) throw error;
    return data.map(d => ({
        id: d.id,
        invoiceNo: d.invoice_no,
        invoiceDate: d.invoice_date,
        dueDate: d.due_date,
        customerName: d.customer_name,
        subtotalAmount: d.subtotal_amount,
        taxAmount: d.tax_amount,
        totalAmount: d.total_amount,
        status: d.status,
        createdAt: d.created_at,
        paidAt: d.paid_at,
        items: d.items.map((i: any) => ({...i, invoiceId: i.invoice_id, jobId: i.job_id, unitPrice: i.unit_price, lineTotal: i.line_total, sortIndex: i.sort_index}))
    }));
};

export const getProjects = async (): Promise<Project[]> => {
    const { data, error } = await supabase.from('projects').select('*, attachments:project_attachments(*)').order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(dbProjectToProject);
};

export const getDepartments = async (): Promise<Department[]> => {
    const { data, error } = await supabase.from('departments').select('*');
    if (error) throw error;
    return data;
};

export const getPaymentRecipients = async (query?: string): Promise<PaymentRecipient[]> => {
    let request = supabase.from('payment_recipients').select('*');
    if (query) {
        request = request.ilike('company_name', `%${query}%`);
    }
    const { data, error } = await request;
    if (error) throw error;
    return data.map(d => ({
        id: d.id,
        recipientCode: d.recipient_code,
        companyName: d.company_name,
        recipientName: d.recipient_name,
    }));
};

export const getActiveAccountItems = async (): Promise<MasterAccountItem[]> => {
    const { data, error } = await supabase.from('account_items').select('id, code, name, category_code').eq('is_active', true).order('code');
    if (error) throw error;
    return data.map(d => ({ ...d, categoryCode: d.category_code }));
};

export const getAllocationDivisions = async (): Promise<AllocationDivision[]> => {
    const { data, error } = await supabase.from('allocation_divisions').select('*').eq('is_active', true);
    if (error) throw error;
    return data.map(d => ({...d, isActive: d.is_active, createdAt: d.created_at}));
};

export const getTitles = async (): Promise<Title[]> => {
    const { data, error } = await supabase.from('employee_titles').select('*').eq('is_active', true);
    if (error) throw error;
    return data.map(d => ({...d, isActive: d.is_active, createdAt: d.created_at}));
};

export const addJob = async (job: Omit<Job, 'id' | 'createdAt' | 'jobNumber'>): Promise<Job> => {
    const { data: maxJobNumberData, error: maxJobNumberError } = await supabase
        .from('jobs')
        .select('job_number')
        .order('job_number', { ascending: false })
        .limit(1)
        .single();

    if (maxJobNumberError && maxJobNumberError.code !== 'PGRST116') {
        throw maxJobNumberError;
    }
    
    const newJobNumber = maxJobNumberData ? maxJobNumberData.job_number + 1 : new Date().getFullYear() * 10000 + 1;
    const dbJob = jobToDbJob({ ...job, jobNumber: newJobNumber });
    const { data, error } = await supabase.from('jobs').insert(dbJob).select().single();
    if (error) throw error;
    return dbJobToJob(data);
};

export const updateJob = async (id: string, updates: Partial<Job>): Promise<Job> => {
    const dbUpdates = jobToDbJob(updates);
    const { data, error } = await supabase.from('jobs').update(dbUpdates).eq('id', id).select().single();
    if (error) throw error;
    return dbJobToJob(data);
};

export const deleteJob = async (id: string): Promise<void> => {
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) throw error;
};

export const updateCustomer = async (id: string, updates: Partial<Customer>): Promise<Customer> => {
    const dbUpdates = customerToDbCustomer(updates);
    const { data, error } = await supabase.from('customers').update(dbUpdates).eq('id', id).select().single();
    if (error) throw error;
    return dbCustomerToCustomer(data);
};

export const addCustomer = async (customer: Partial<Customer>): Promise<Customer> => {
    const dbCustomer = customerToDbCustomer(customer);
    const { data, error } = await supabase.from('customers').insert(dbCustomer).select().single();
    if (error) throw error;
    return dbCustomerToCustomer(data);
};

export const updateLead = async (id: string, updates: Partial<Lead>): Promise<Lead> => {
    const dbUpdates = leadToDbLead(updates);
    const { data, error } = await supabase.from('leads').update(dbUpdates).eq('id', id).select().single();
    if (error) throw error;
    return dbLeadToLead(data);
};

export const deleteLead = async (id: string): Promise<void> => {
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) throw error;
};

export const addEstimate = async (estimate: Partial<Omit<Estimate, 'id' | 'createdAt' | 'updatedAt' | 'estimateNumber'>>): Promise<Estimate> => {
    const dbEstimate = estimateToDbEstimate(estimate);
    const { data, error } = await supabase.from('estimates').insert(dbEstimate).select().single();
    if (error) throw error;
    return dbEstimateToEstimate(data);
};

export const addJournalEntry = async (entry: Omit<JournalEntry, 'id' | 'date'>): Promise<JournalEntry> => {
    const { data, error } = await supabase.from('journal_entries').insert({ ...entry, date: new Date().toISOString() }).select().single();
    if (error) throw error;
    return data;
};

export const updateBugReport = async (id: string, updates: Partial<BugReport>): Promise<BugReport> => {
    const dbUpdates = bugReportToDbBugReport(updates);
    const { data, error } = await supabase.from('bug_reports').update(dbUpdates).eq('id', id).select().single();
    if (error) throw error;
    return dbBugReportToBugReport(data);
};

export const saveAccountItem = async (item: Partial<AccountItem>): Promise<AccountItem> => {
    const dbItem = { ...item, category_code: item.categoryCode, is_active: item.isActive, sort_order: item.sortOrder };
    const { data, error } = await supabase.from('account_items').upsert(dbItem).select().single();
    if (error) throw error;
    return { ...data, categoryCode: data.category_code, isActive: data.is_active, sortOrder: data.sort_order, createdAt: data.created_at, updatedAt: data.updated_at };
};

export const deactivateAccountItem = async (id: string): Promise<void> => {
    const { error } = await supabase.from('account_items').update({ is_active: false }).eq('id', id);
    if (error) throw error;
};

export const savePaymentRecipient = async (item: Partial<PaymentRecipient>): Promise<PaymentRecipient> => {
    const dbItem = { ...item, recipient_code: item.recipientCode, company_name: item.companyName, recipient_name: item.recipientName };
    const { data, error } = await supabase.from('payment_recipients').upsert(dbItem).select().single();
    if (error) throw error;
    return { ...data, recipientCode: data.recipient_code, companyName: data.company_name, recipientName: data.recipient_name };
};

export const deletePaymentRecipient = async (id: string): Promise<void> => {
    const { error } = await supabase.from('payment_recipients').delete().eq('id', id);
    if (error) throw error;
};

export const saveAllocationDivision = async (item: Partial<AllocationDivision>): Promise<AllocationDivision> => {
    const { data, error } = await supabase.from('allocation_divisions').upsert(item).select().single();
    if (error) throw error;
    return { ...data, isActive: data.is_active, createdAt: data.created_at };
};

export const deleteAllocationDivision = async (id: string): Promise<void> => {
    const { error } = await supabase.from('allocation_divisions').delete().eq('id', id);
    if (error) throw error;
};

export const saveDepartment = async (item: Partial<Department>): Promise<Department> => {
    const { data, error } = await supabase.from('departments').upsert(item).select().single();
    if (error) throw error;
    return data;
};

export const deleteDepartment = async (id: string): Promise<void> => {
    const { error } = await supabase.from('departments').delete().eq('id', id);
    if (error) throw error;
};

export const saveTitle = async (item: Partial<Title>): Promise<Title> => {
    const { data, error } = await supabase.from('employee_titles').upsert(item).select().single();
    if (error) throw error;
    return { ...data, isActive: data.is_active, createdAt: data.created_at };
};

export const deleteTitle = async (id: string): Promise<void> => {
    const { error } = await supabase.from('employee_titles').delete().eq('id', id);
    if (error) throw error;
};

export const addLead = async (lead: Partial<Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Lead> => {
    const { data, error } = await supabase.from('leads').insert(leadToDbLead(lead)).select().single();
    if (error) throw error;
    return dbLeadToLead(data);
};

export const updateInventoryItem = async (id: string, item: Partial<InventoryItem>): Promise<InventoryItem> => {
    const { data, error } = await supabase.from('inventory_items').update({ ...item, unit_price: item.unitPrice }).eq('id', id).select().single();
    if (error) throw error;
    return { ...data, unitPrice: data.unit_price };
};

export const addInventoryItem = async (item: Omit<InventoryItem, 'id'>): Promise<InventoryItem> => {
    const { data, error } = await supabase.from('inventory_items').insert({ ...item, unit_price: item.unitPrice }).select().single();
    if (error) throw error;
    return { ...data, unitPrice: data.unit_price };
};

export const addPurchaseOrder = async (order: Omit<PurchaseOrder, 'id'>): Promise<PurchaseOrder> => {
    const { data, error } = await supabase.from('purchase_orders').insert({ ...order, supplier_name: order.supplierName, item_name: order.itemName, order_date: order.orderDate, unit_price: order.unitPrice }).select().single();
    if (error) throw error;
    return { ...data, supplierName: data.supplier_name, itemName: data.item_name, orderDate: data.order_date, unitPrice: data.unit_price };
};

export const addBugReport = async (report: Omit<BugReport, 'id' | 'createdAt' | 'status'>): Promise<BugReport> => {
    const { data, error } = await supabase.from('bug_reports').insert({ ...bugReportToDbBugReport(report), status: 'Open' }).select().single();
    if (error) throw error;
    return dbBugReportToBugReport(data);
};

export const uploadFile = async (file: File, bucket: string): Promise<{ path: string }> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${fileName}`;
    const { error } = await supabase.storage.from(bucket).upload(filePath, file);
    if (error) throw error;
    return { path: filePath };
};

export const getInboxItems = async (): Promise<InboxItem[]> => {
    const { data, error } = await supabase.from('inbox_items').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(d => ({
        id: d.id,
        fileName: d.file_name,
        filePath: d.file_path,
        fileUrl: supabase.storage.from('inbox').getPublicUrl(d.file_path).data.publicUrl,
        mimeType: d.mime_type,
        status: d.status,
        extractedData: d.extracted_data,
        errorMessage: d.error_message,
        createdAt: d.created_at,
    }));
};

export const addInboxItem = async (item: Omit<InboxItem, 'id' | 'createdAt' | 'fileUrl'>): Promise<InboxItem> => {
    const { data, error } = await supabase.from('inbox_items').insert({
        file_name: item.fileName,
        file_path: item.filePath,
        mime_type: item.mimeType,
        status: item.status,
        extracted_data: item.extractedData,
        error_message: item.errorMessage,
    }).select().single();
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('inbox').getPublicUrl(data.file_path);
    return { ...data, fileName: data.file_name, filePath: data.file_path, mimeType: data.mime_type, extractedData: data.extracted_data, errorMessage: data.error_message, createdAt: data.created_at, fileUrl: publicUrl };
};

export const updateInboxItem = async (id: string, updates: Partial<InboxItem>): Promise<InboxItem> => {
    const { data, error } = await supabase.from('inbox_items').update({ extracted_data: updates.extractedData, status: updates.status }).eq('id', id).select().single();
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('inbox').getPublicUrl(data.file_path);
    return { ...data, fileName: data.file_name, filePath: data.file_path, mimeType: data.mime_type, extractedData: data.extracted_data, errorMessage: data.error_message, createdAt: data.created_at, fileUrl: publicUrl };
};

export const deleteInboxItem = async (item: InboxItem): Promise<void> => {
    const { error: storageError } = await supabase.storage.from('inbox').remove([item.filePath]);
    if (storageError) throw storageError;
    const { error: dbError } = await supabase.from('inbox_items').delete().eq('id', item.id);
    if (dbError) throw dbError;
};

export const submitApplication = async (appData: { applicationCodeId: string; formData: any; approvalRouteId: string; }, applicantId: string): Promise<Application> => {
    const { data: routeData, error: routeError } = await supabase.from('approval_routes').select('route_data').eq('id', appData.approvalRouteId).single();
    if (routeError) throw routeError;
    const firstApproverId = routeData?.route_data?.steps?.[0]?.approverId;
    if (!firstApproverId) {
        throw new Error('Approval route is misconfigured.');
    }
    const { data, error } = await supabase.from('applications').insert({
        applicant_id: applicantId,
        application_code_id: appData.applicationCodeId,
        form_data: appData.formData,
        approval_route_id: appData.approvalRouteId,
        status: 'pending_approval',
        submitted_at: new Date().toISOString(),
        current_level: 1,
        approver_id: firstApproverId,
    }).select().single();
    if (error) throw error;
    return data;
};

export const updateJobReadyToInvoice = async (jobId: string, value: boolean): Promise<void> => {
    const { error } = await supabase.from('jobs').update({ ready_to_invoice: value }).eq('id', jobId);
    if (error) throw error;
};

export const createInvoiceFromJobs = async (jobIds: string[]): Promise<Invoice> => {
    // This would be a server-side function in a real app
    const { data: jobs, error } = await supabase.from('jobs').select('*').in('id', jobIds);
    if (error) throw error;
    if (!jobs || jobs.length === 0) throw new Error("No jobs found");

    const customerName = jobs[0].client_name;
    const invoiceDate = new Date().toISOString().split('T')[0];

    let subtotal = 0;
    const invoiceItems = jobs.map((job, index) => {
        subtotal += job.price;
        return {
            description: job.title,
            quantity: 1,
            unit: '式',
            unit_price: job.price,
            line_total: job.price,
            job_id: job.id,
            sort_index: index,
        };
    });
    const tax = subtotal * 0.1;
    const total = subtotal + tax;
    
    const { data: invoice, error: invoiceError } = await supabase.from('invoices').insert({
        invoice_no: `INV-${Date.now()}`,
        invoice_date: invoiceDate,
        customer_name: customerName,
        subtotal_amount: subtotal,
        tax_amount: tax,
        total_amount: total,
        status: 'issued',
    }).select().single();
    if (invoiceError) throw invoiceError;
    
    const itemsWithInvoiceId = invoiceItems.map(item => ({...item, invoice_id: invoice.id}));
    const { error: itemsError } = await supabase.from('invoice_items').insert(itemsWithInvoiceId);
    if (itemsError) throw itemsError;

    const { error: jobUpdateError } = await supabase.from('jobs').update({ invoice_id: invoice.id, invoice_status: InvoiceStatus.Invoiced, invoiced_at: new Date().toISOString() }).in('id', jobIds);
    if (jobUpdateError) throw jobUpdateError;
    
    return { ...invoice, invoiceNo: invoice.invoice_no, invoiceDate: invoice.invoice_date, customerName: invoice.customer_name, subtotalAmount: invoice.subtotal_amount, taxAmount: invoice.tax_amount, totalAmount: invoice.total_amount, createdAt: invoice.created_at, paidAt: invoice.paid_at };
};

export const approveApplication = async (app: ApplicationWithDetails, currentUser: EmployeeUser): Promise<void> => {
    const route = app.approvalRoute;
    if (!route) throw new Error("Approval route not found");
    const currentStepIndex = app.currentLevel - 1;
    const nextStep = route.routeData.steps[currentStepIndex + 1];

    if (nextStep) {
        const { error } = await supabase.from('applications').update({
            current_level: app.currentLevel + 1,
            approver_id: nextStep.approverId,
        }).eq('id', app.id);
        if (error) throw error;
    } else {
        const { error } = await supabase.from('applications').update({
            status: 'approved',
            approved_at: new Date().toISOString(),
            approver_id: null,
        }).eq('id', app.id);
        if (error) throw error;
    }
};

export const rejectApplication = async (app: ApplicationWithDetails, reason: string, currentUser: EmployeeUser): Promise<void> => {
    const { error } = await supabase.from('applications').update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
        approver_id: null,
    }).eq('id', app.id);
    if (error) throw error;
};

export const addUser = async (user: Omit<User, 'id' | 'createdAt'>): Promise<User> => {
    // This is simplified. Real user creation involves Supabase Auth.
    // This function assumes auth user already exists and we are creating the profile.
    const { data, error } = await supabase.from('users').insert(user).select().single();
    if (error) throw error;
    return data;
};

export const updateUser = async (id: string, updates: Partial<EmployeeUser>): Promise<User> => {
    const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
};

export const deleteUser = async (id: string): Promise<void> => {
    // This is simplified. Real user deletion involves Supabase Auth.
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
};

export const addApprovalRoute = async (route: {name: string, routeData: {steps: {approverId: string}[]}}): Promise<ApprovalRoute> => {
    const { data, error } = await supabase.from('approval_routes').insert({name: route.name, route_data: {steps: route.routeData.steps.map(s => ({approver_id: s.approverId}))}}).select().single();
    if (error) throw error;
    return dbApprovalRouteToApprovalRoute(data);
};

export const updateApprovalRoute = async (id: string, updates: Partial<{name: string, routeData: any}>): Promise<ApprovalRoute> => {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.routeData) dbUpdates.route_data = {steps: updates.routeData.steps.map((s:any) => ({approver_id: s.approverId}))};
    const { data, error } = await supabase.from('approval_routes').update(dbUpdates).eq('id', id).select().single();
    if (error) throw error;
    return dbApprovalRouteToApprovalRoute(data);
};

export const deleteApprovalRoute = async (id: string): Promise<void> => {
    const { error } = await supabase.from('approval_routes').delete().eq('id', id);
    if (error) throw error;
};

export const savePostal = async (id: UUID, patch: Partial<PostalInfo>): Promise<Estimate> => {
    const { data, error } = await supabase.rpc('update_postal_info', { estimate_id: id, postal_patch: patch });
    if (error) throw error;
    return dbEstimateToEstimate(data[0]);
};

export const renderPostalLabelSvg = (toName: string, toCompany?: string): string => {
    return `<svg width="300" height="150" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="150" fill="white"/><text x="10" y="40" font-size="20">${toCompany || ''}</text><text x="10" y="80" font-size="24" font-weight="bold">${toName}様</text></svg>`;
};

export const updateEstimate = async (id: UUID, patch: Partial<Estimate>): Promise<Estimate> => {
    const dbPatch = estimateToDbEstimate(patch);
    const { data, error } = await supabase.from('estimates').update(dbPatch).eq('id', id).select().single();
    if (error) throw error;
    return dbEstimateToEstimate(data);
};

export const saveTracking = async (id: UUID, patch: Partial<TrackingInfo>): Promise<Estimate> => {
    const { data, error } = await supabase.rpc('update_tracking_info', { estimate_id: id, tracking_patch: patch });
    if (error) throw error;
    return dbEstimateToEstimate(data[0]);
};

export const addProject = async (project: Partial<Omit<Project, 'id'>>, files: {file: File, category: string}[]): Promise<Project> => {
    const { data, error } = await supabase.from('projects').insert(project).select().single();
    if (error) throw error;
    
    if (files.length > 0) {
        const attachments = await Promise.all(files.map(async ({file, category}) => {
            const { path } = await uploadFile(file, 'project_files');
            return {
                project_id: data.id,
                file_name: file.name,
                file_path: path,
                mime_type: file.type,
                category: category,
            };
        }));
        const { error: attError } = await supabase.from('project_attachments').insert(attachments);
        if (attError) throw attError;
    }

    const { data: finalData, error: finalError } = await supabase.from('projects').select('*, attachments:project_attachments(*)').eq('id', data.id).single();
    if (finalError) throw finalError;

    return dbProjectToProject(finalData);
};

export const getAnalysisHistory = async (userId: string): Promise<AnalysisHistory[]> => {
    const { data, error } = await supabase.from('analysis_history').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(dbToAnalysisHistory);
};

export const addAnalysisHistory = async (history: Omit<AnalysisHistory, 'id' | 'createdAt'>): Promise<AnalysisHistory> => {
    const { data, error } = await supabase.from('analysis_history').insert({
        user_id: history.userId,
        viewpoint: history.viewpoint,
        data_sources: history.dataSources,
        result: history.result,
    }).select().single();
    if (error) throw error;
    return dbToAnalysisHistory(data);
};