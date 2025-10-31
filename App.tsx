import { GEMINI_API_KEY, IS_AI_DISABLED } from './src/config.ts';
console.log('GEMINI_CONFIGURED', !!GEMINI_API_KEY);
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Sidebar from './components/Sidebar.tsx';
import Header from './components/Header.tsx';
import Dashboard from './components/Dashboard.tsx';
import JobList from './components/JobList.tsx';
import CreateJobModal from './components/CreateJobModal.tsx';
import JobDetailModal from './components/JobDetailModal.tsx';
import CustomerList from './components/CustomerList.tsx';
import CustomerDetailModal from './components/CustomerDetailModal.tsx';
import { CompanyAnalysisModal } from './components/CompanyAnalysisModal.tsx';
import LeadManagementPage from './sales/LeadManagementPage.tsx';
import CreateLeadModal from './components/sales/CreateLeadModal.tsx';
import PlaceholderPage from './components/PlaceholderPage.tsx';
import UserManagementPage from './components/admin/UserManagementPage.tsx';
import ApprovalRouteManagementPage from './components/admin/ApprovalRouteManagementPage.tsx';
import GoogleSettingsPage from './components/admin/GoogleSettingsPage.tsx';
import BugReportList from './components/admin/BugReportList.tsx';
import SettingsPage from './components/SettingsPage.tsx';
import AccountingPage from './components/Accounting.tsx';
import SalesPipelinePage from './components/sales/SalesPipelinePage.tsx';
import InventoryManagementPage from './components/inventory/InventoryManagementPage.tsx';
import CreateInventoryItemModal from './components/inventory/CreateInventoryItemModal.tsx';
import ManufacturingPipelinePage from './components/manufacturing/ManufacturingPipelinePage.tsx';
import ManufacturingOrdersPage from './components/manufacturing/ManufacturingOrdersPage.tsx';
import PurchasingManagementPage from './components/purchasing/PurchasingManagementPage.tsx';
import CreatePurchaseOrderModal from './components/purchasing/CreatePurchaseOrderModal.tsx';
import EstimateManagementPage from './components/sales/EstimateManagementPage.tsx';
import EstimateCreationPage from './components/sales/EstimateCreationPage.tsx';
import ProjectListPage from './components/sales/ProjectListPage.tsx';
import ProjectCreationPage from './components/sales/ProjectCreationPage.tsx';
import SalesRanking from './components/accounting/SalesRanking.tsx';
import BusinessPlanPage from './components/accounting/BusinessPlanPage.tsx';
import ApprovalWorkflowPage from './components/accounting/ApprovalWorkflowPage.tsx';
import BusinessSupportPage from './components/BusinessSupportPage.tsx';
import AIChatPage from './components/AIChatPage.tsx';
import MarketResearchPage from './components/MarketResearchPage.tsx';
import LiveChatPage from './components/LiveChatPage.tsx';
import AnythingAnalysisPage from './components/AnythingAnalysisPage.tsx';
import { ToastContainer } from './components/Toast.tsx';
import ConfirmationDialog from './components/ConfirmationDialog.tsx';
import ManufacturingCostManagement from './components/accounting/ManufacturingCostManagement.tsx';
import AuditLogPage from './components/admin/AuditLogPage.tsx';
import JournalQueuePage from './components/admin/JournalQueuePage.tsx';
import MasterManagementPage from './components/admin/MasterManagementPage.tsx';
import DatabaseSetupInstructionsModal from './components/DatabaseSetupInstructionsModal.tsx';
import OrganizationChartPage from './components/hr/OrganizationChartPage.tsx';
import LoginPage from './components/LoginPage.tsx';
import BugReportModal from './components/BugReportModal.tsx';


import * as dataService from './services/dataService.ts';
import * as geminiService from './services/geminiService.ts';
import { supabase, hasSupabaseCredentials } from './services/supabaseClient.ts';
import { Session } from '@supabase/supabase-js';

// FIX: Import ApplicationCode type to resolve 'Cannot find name' error.
import { Page, Job, Customer, JournalEntry, User, AccountItem, Lead, ApprovalRoute, PurchaseOrder, InventoryItem, Employee, Toast, ConfirmationDialogProps, BugReport, Estimate, ApplicationWithDetails, Invoice, EmployeeUser, Department, PaymentRecipient, MasterAccountItem, AllocationDivision, Title, Project, ApplicationCode } from './types.ts';
import { PlusCircle, Loader, AlertTriangle, RefreshCw, Settings, Bug } from './components/Icons.tsx';

const PAGE_TITLES: Record<Page, string> = {
    analysis_dashboard: 'ホーム',
    sales_leads: '問い合わせ管理',
    sales_customers: '取引先管理',
    sales_pipeline: '進捗管理',
    sales_estimates: '見積管理',
    sales_orders: '受注管理',
    sales_billing: '売上・請求管理',
    sales_delivery: '納品管理',
    analysis_ranking: '売上ランキング',
    purchasing_orders: '発注 (PO)',
    purchasing_invoices: '仕入計上 (AP)',
    purchasing_payments: '支払管理',
    purchasing_suppliers: '発注先一覧',
    inventory_management: '在庫管理',
    manufacturing_orders: '製造指示',
    manufacturing_progress: '製造パイプライン',
    manufacturing_cost: '製造原価',
    hr_attendance: '勤怠',
    hr_man_hours: '工数',
    hr_labor_cost: '人件費配賦',
    hr_org_chart: '組織図',
    approval_list: '承認一覧',
    approval_form_expense: '経費精算',
    approval_form_transport: '交通費申請',
    approval_form_leave: '休暇申請',
    approval_form_approval: '経費なし稟議申請',
    approval_form_daily: '日報',
    approval_form_weekly: '週報',
    report_other: '営業・セミナー・その他報告',
    accounting_journal: '仕訳帳',
    accounting_general_ledger: '総勘定元帳',
    accounting_trial_balance: '試算表',
    accounting_tax_summary: '消費税集計',
    accounting_period_closing: '締処理',
    accounting_business_plan: '経営計画',
    business_support_proposal: '提案書作成',
    ai_anything_analysis: 'なんでも分析',
    ai_business_consultant: 'AI業務支援',
    ai_market_research: 'AI市場調査',
    ai_live_chat: 'AIライブチャット',
    estimate_creation: '新規見積作成',
    project_list: '案件一覧',
    project_creation: '新規案件作成',
    admin_audit_log: '監査ログ',
    admin_journal_queue: 'ジャーナル・キュー',
    admin_user_management: 'ユーザー管理',
    admin_route_management: '承認ルート管理',
    admin_master_management: 'マスタ管理',
    admin_google_settings: 'Google連携設定',
    admin_bug_reports: '改善要望一覧',
    settings: '設定',
};

const GlobalErrorBanner: React.FC<{ error: string; onRetry: () => void; onShowSetup: () => void; }> = ({ error, onRetry, onShowSetup }) => (
    <div className="bg-red-600 text-white p-3 flex items-center justify-between gap-4 flex-shrink-0 z-20">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 flex-shrink-0" />
        <div>
          <h3 className="font-bold">データベースエラー</h3>
          <p className="text-sm">{error}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button 
          onClick={onRetry} 
          className="bg-red-700 hover:bg-red-800 text-white font-semibold text-sm py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors">
          <RefreshCw className="w-4 h-4" />
          再接続
        </button>
        <button 
          onClick={onShowSetup}
          className="bg-slate-600 hover:bg-slate-700 text-white font-semibold text-sm py-1.5 px-3 rounded-md flex items-center gap-1.5 transition-colors">
          <Settings className="w-4 h-4" />
          セットアップガイド
        </button>
      </div>
    </div>
);

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    const [currentPage, setCurrentPage] = useState<Page>('analysis_dashboard');
    const [currentUser, setCurrentUser] = useState<EmployeeUser | null>(null);
    const [allUsers, setAllUsers] = useState<EmployeeUser[]>([]);

    const [jobs, setJobs] = useState<Job[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    const [accountItems, setAccountItems] = useState<AccountItem[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [approvalRoutes, setApprovalRoutes] = useState<ApprovalRoute[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [bugReports, setBugReports] = useState<BugReport[]>([]);
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
    const [applicationCodes, setApplicationCodes] = useState<ApplicationCode[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);

    // Master data
    const [departments, setDepartments] = useState<Department[]>([]);
    const [paymentRecipients, setPaymentRecipients] = useState<PaymentRecipient[]>([]);
    const [masterAccountItems, setMasterAccountItems] = useState<MasterAccountItem[]>([]);
    const [allocationDivisions, setAllocationDivisions] = useState<AllocationDivision[]>([]);
    const [titles, setTitles] = useState<Title[]>([]);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAIOff, setIsAIOff] = useState(false);
    
    // Modals
    const [isCreateJobModalOpen, setIsCreateJobModalOpen] = useState(false);
    const [isCreateLeadModalOpen, setIsCreateLeadModalOpen] = useState(false);
    const [isCreateInventoryItemModalOpen, setIsCreateInventoryItemModalOpen] = useState(false);
    const [isCreatePurchaseOrderModalOpen, setIsCreatePurchaseOrderModalOpen] = useState(false);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerModalMode, setCustomerModalMode] = useState<'view' | 'edit' | 'new'>('view');
    const [isCompanyAnalysisModalOpen, setIsCompanyAnalysisModalOpen] = useState(false);
    const [analysisTargetCustomer, setAnalysisTargetCustomer] = useState<Customer | null>(null);
    const [companyAnalysis, setCompanyAnalysis] = useState<any>(null);
    const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
    const [analysisError, setAnalysisError] = useState('');
    const [showSetup, setShowSetup] = useState(false);
    const [isBugReportModalOpen, setIsBugReportModalOpen] = useState(false);

    // Toasts
    const [toasts, setToasts] = useState<Toast[]>([]);
    const addToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
        setToasts(prev => [...prev, { id: Date.now(), message, type }]);
    }, []);

    // Confirmation Dialog
    const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialogProps>({
        isOpen: false, title: '', message: '', onConfirm: () => {}, onClose: () => {}
    });
    const requestConfirmation = useCallback((dialog: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>) => {
        setConfirmationDialog({ ...dialog, isOpen: true, onClose: () => setConfirmationDialog(prev => ({...prev, isOpen: false})) });
    }, []);

    const loadData = useCallback(async (user: EmployeeUser) => {
      if (!hasSupabaseCredentials()) {
        setError('Supabaseの接続情報が設定されていません。services/supabaseClient.tsを編集してください。');
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const [
            usersData, jobsData, customersData, journalEntriesData, accountItemsData, leadsData,
            approvalRoutesData, purchaseOrdersData, inventoryItemsData, employeesData,
            bugReportsData, estimatesData, applicationsData, applicationCodesData,
            invoicesData, projectsData, departmentsData, paymentRecipientsData,
            masterAccountItemsData, allocationDivisionsData, titlesData
        ] = await Promise.all([
            dataService.getUsers(), dataService.getJobs(), dataService.getCustomers(), dataService.getJournalEntries(), dataService.getAccountItems(), dataService.getLeads(),
            dataService.getApprovalRoutes(), dataService.getPurchaseOrders(), dataService.getInventoryItems(), dataService.getEmployees(),
            dataService.getBugReports(), dataService.getEstimates(), dataService.getApplications(user), dataService.getApplicationCodes(),
            dataService.getInvoices(), dataService.getProjects(), dataService.getDepartments(), dataService.getPaymentRecipients(),
            dataService.getActiveAccountItems(), dataService.getAllocationDivisions(), dataService.getTitles()
        ]);
        setAllUsers(usersData);
        setJobs(jobsData);
        setCustomers(customersData);
        setJournalEntries(journalEntriesData);
        setAccountItems(accountItemsData);
        setLeads(leadsData);
        setApprovalRoutes(approvalRoutesData);
        setPurchaseOrders(purchaseOrdersData);
        setInventoryItems(inventoryItemsData);
        setEmployees(employeesData);
        setBugReports(bugReportsData);
        setEstimates(estimatesData);
        setApplications(applicationsData);
        setApplicationCodes(applicationCodesData);
        setInvoices(invoicesData);
        setProjects(projectsData);
        setDepartments(departmentsData);
        setPaymentRecipients(paymentRecipientsData);
        setMasterAccountItems(masterAccountItemsData);
        setAllocationDivisions(allocationDivisionsData);
        setTitles(titlesData);
      } catch (err: any) {
        if (dataService.isSupabaseUnavailableError(err)) {
          setError('データベースに接続できませんでした。ネットワーク接続を確認してください。');
        } else {
          setError(`データの読み込みに失敗しました: ${err.message}`);
        }
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }, []);

    useEffect(() => {
        if (IS_AI_DISABLED) { setIsAIOff(true); addToast('AI機能は無効です(設定)。','info'); } else if (!GEMINI_API_KEY) { setIsAIOff(true); addToast('AI機能は無効です: Gemini鍵未設定。','info'); } else { setIsAIOff(false); }
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session);
            if (session?.user) {
                try {
                    setError(null); // Clear previous errors on a new auth state change
                    const userProfile = await dataService.resolveUserSession(session.user);
                    setCurrentUser(userProfile);
                } catch (e) {
                    const errorMessage = e instanceof Error ? e.message : 'ユーザープロファイルの取得または作成に失敗しました。データベースのスキーマが最新でない可能性があります。セットアップガイドを確認してください。';
                    setError(errorMessage);
                    addToast(errorMessage, 'error');
                    // Do NOT sign out. This prevents the login loop. The user is authenticated
                    // but their profile is missing. The error banner will inform them.
                    setCurrentUser(null); // Set user to null to prevent data loading attempts.
                }
            } else {
                setCurrentUser(null);
            }
            setAuthLoading(false);
        });

        return () => {
            subscription?.unsubscribe();
        };
    }, [addToast]);

    useEffect(() => {
        if (currentUser) {
            loadData(currentUser);
        } else {
            // Reset all data on logout
            setJobs([]); setCustomers([]); setJournalEntries([]); setAccountItems([]); setLeads([]);
            setApprovalRoutes([]); setPurchaseOrders([]); setInventoryItems([]); setEmployees([]);
            setBugReports([]); setEstimates([]); setApplications([]); setApplicationCodes([]);
            setInvoices([]); setProjects([]); setDepartments([]); setPaymentRecipients([]);
            setMasterAccountItems([]); setAllocationDivisions([]); setTitles([]);
        }
    }, [currentUser, loadData]);

    const handleSignOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) addToast(`ログアウトに失敗しました: ${error.message}`, 'error');
    };

    const handleNavigate = useCallback((page: Page) => {
        setCurrentPage(page);
        setSearchTerm('');
    }, []);

    const primaryAction = useMemo(() => {
        const actions: Partial<Record<Page, { label: string; onClick: () => void; icon: React.ElementType }>> = {
            analysis_dashboard: { label: '新規案件作成', onClick: () => setIsCreateJobModalOpen(true), icon: PlusCircle },
            sales_customers: { label: '新規顧客登録', onClick: () => { setSelectedCustomer(null); setCustomerModalMode('new'); }, icon: PlusCircle },
            sales_leads: { label: '新規リード追加', onClick: () => setIsCreateLeadModalOpen(true), icon: PlusCircle },
            inventory_management: { label: '新規品目登録', onClick: () => setIsCreateInventoryItemModalOpen(true), icon: PlusCircle },
            purchasing_orders: { label: '新規発注作成', onClick: () => setIsCreatePurchaseOrderModalOpen(true), icon: PlusCircle },
            sales_estimates: { label: '新規見積作成', onClick: () => handleNavigate('estimate_creation'), icon: PlusCircle },
            project_list: { label: '新規案件作成', onClick: () => handleNavigate('project_creation'), icon: PlusCircle },
        };
        const currentPageKey = Object.keys(actions).find(key => currentPage.startsWith(key));
        return currentPageKey ? actions[currentPageKey as Page] : undefined;
    }, [currentPage, handleNavigate]);

    const handleAnalyzeCustomer = useCallback(async (customer: Customer) => {
        if (isAIOff) {
            addToast('AI機能は無効です。', 'error');
            return;
        }
        setAnalysisTargetCustomer(customer);
        setIsCompanyAnalysisModalOpen(true);
        setIsAnalysisLoading(true);
        setAnalysisError('');
        try {
            const analysis = await geminiService.analyzeCompany(customer);
            setCompanyAnalysis(analysis);
        } catch (e: any) {
            setAnalysisError(e.message || "分析中に不明なエラーが発生しました。");
        } finally {
            setIsAnalysisLoading(false);
        }
    }, [isAIOff, addToast]);
    
    const handleReanalyze = (customer: Customer) => {
        if (customer) {
            handleAnalyzeCustomer(customer);
        }
    };

    if (authLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader className="w-12 h-12 animate-spin text-blue-500" /></div>;
    }
    
    if (!session || !currentUser) {
        return <LoginPage />;
    }

    return (
        <div className="flex h-screen w-full font-sans bg-slate-100 dark:bg-slate-900">
            {error && <GlobalErrorBanner error={error} onRetry={() => { if(currentUser) loadData(currentUser); }} onShowSetup={() => setShowSetup(true)}/>}
            <Sidebar currentPage={currentPage} onNavigate={handleNavigate} currentUser={currentUser} onSignOut={handleSignOut}/>
            <main className="flex-1 flex flex-col p-8 overflow-y-auto">
                <Header 
                    title={PAGE_TITLES[currentPage] || currentPage} 
                    primaryAction={primaryAction} 
                    search={currentPage.startsWith('sales_') || currentPage.startsWith('admin_bug_reports') ? {
                        value: searchTerm,
                        onChange: setSearchTerm,
                        placeholder: `${PAGE_TITLES[currentPage]}を検索...`
                    } : undefined}
                />
                <div className="flex-1 mt-6">
                    {isLoading && !error ? <div className="flex justify-center items-center h-full"><Loader className="w-12 h-12 animate-spin text-blue-500" /></div> :
                     !hasSupabaseCredentials() ? <div className="text-red-500">Supabaseの接続情報が設定されていません。</div> :
                     (() => {
                        switch (currentPage) {
                            case 'analysis_dashboard': return <Dashboard jobs={jobs} journalEntries={journalEntries} accountItems={accountItems} pendingApprovalCount={applications.filter(a => a.approverId === currentUser?.id && a.status === 'pending_approval').length} onNavigateToApprovals={() => handleNavigate('approval_list')} />;
                            case 'sales_orders': return <JobList jobs={jobs} searchTerm={searchTerm} onSelectJob={setSelectedJob} onNewJob={() => setIsCreateJobModalOpen(true)} />;
                            case 'sales_customers': return <CustomerList customers={customers} searchTerm={searchTerm} onSelectCustomer={(c) => {setSelectedCustomer(c); setCustomerModalMode('view');}} onUpdateCustomer={async (id, data) => {await dataService.updateCustomer(id, data); loadData(currentUser);}} onAnalyzeCustomer={handleAnalyzeCustomer} addToast={addToast} currentUser={currentUser} onNewCustomer={() => {setSelectedCustomer(null); setCustomerModalMode('new');}} isAIOff={isAIOff} />;
                            case 'sales_leads': return <LeadManagementPage leads={leads} searchTerm={searchTerm} onRefresh={() => loadData(currentUser)} onUpdateLead={async (id, data) => {await dataService.updateLead(id, data); loadData(currentUser);}} onDeleteLead={async (id) => {await dataService.deleteLead(id); loadData(currentUser);}} addToast={addToast} requestConfirmation={requestConfirmation} currentUser={currentUser} isAIOff={isAIOff} onAddEstimate={async (est) => {await dataService.addEstimate(est); loadData(currentUser);}} />;
                            case 'sales_pipeline': return <SalesPipelinePage jobs={jobs} onUpdateJob={async (id, data) => {await dataService.updateJob(id, data); loadData(currentUser);}} onCardClick={setSelectedJob} />;
                            case 'inventory_management': return <InventoryManagementPage inventoryItems={inventoryItems} onSelectItem={(item) => setIsCreateInventoryItemModalOpen(true)} />;
                            case 'manufacturing_progress': return <ManufacturingPipelinePage jobs={jobs} onUpdateJob={async (id, data) => {await dataService.updateJob(id, data); loadData(currentUser);}} onCardClick={setSelectedJob} />;
                            case 'manufacturing_orders': return <ManufacturingOrdersPage jobs={jobs} onSelectJob={setSelectedJob} />;
                            case 'purchasing_orders': return <PurchasingManagementPage purchaseOrders={purchaseOrders} />;
                            case 'admin_user_management': return <UserManagementPage addToast={addToast} requestConfirmation={requestConfirmation} />;
                            case 'admin_route_management': return <ApprovalRouteManagementPage addToast={addToast} requestConfirmation={requestConfirmation} />;
                            case 'admin_google_settings': return <GoogleSettingsPage addToast={addToast} />;
                            case 'admin_bug_reports': return <BugReportList reports={bugReports} onUpdateReport={async (id, data) => {await dataService.updateBugReport(id, data); loadData(currentUser);}} searchTerm={searchTerm} />;
                            case 'settings': return <SettingsPage addToast={addToast} />;
                            case 'accounting_journal':
                            case 'sales_billing':
                            case 'purchasing_invoices':
                            case 'purchasing_payments':
                            case 'hr_labor_cost':
                            case 'accounting_general_ledger':
                            case 'accounting_trial_balance':
                            case 'accounting_period_closing':
                                // FIX: Pass allocationDivisions to AccountingPage
                                return <AccountingPage page={currentPage} journalEntries={journalEntries} accountItems={accountItems} onAddEntry={async (entry) => {await dataService.addJournalEntry(entry); loadData(currentUser);}} addToast={addToast} requestConfirmation={requestConfirmation} jobs={jobs} applications={applications} onNavigate={handleNavigate} customers={customers} employees={employees} onRefreshData={() => loadData(currentUser)} isAIOff={isAIOff} allocationDivisions={allocationDivisions} />;
                            case 'sales_estimates': return <EstimateManagementPage estimates={estimates} customers={customers} allUsers={allUsers} addToast={addToast} currentUser={currentUser} searchTerm={searchTerm} isAIOff={isAIOff} onNavigateToCreate={handleNavigate} />;
                            case 'estimate_creation': return <EstimateCreationPage customers={customers} allUsers={allUsers} addToast={addToast} currentUser={currentUser} isAIOff={isAIOff} onCreateEstimate={async (est) => {await dataService.addEstimate(est as any); loadData(currentUser);}} onNavigateBack={() => handleNavigate('sales_estimates')} />;
                            case 'project_list': return <ProjectListPage projects={projects} onNavigateToCreate={() => handleNavigate('project_creation')} />;
                            case 'project_creation': return <ProjectCreationPage onNavigateBack={() => handleNavigate('project_list')} onProjectCreated={() => {addToast('案件を作成しました', 'success'); loadData(currentUser); handleNavigate('project_list');}} customers={customers} currentUser={currentUser} isAIOff={isAIOff} addToast={addToast} />;
                            case 'analysis_ranking': return <SalesRanking jobs={jobs} />;
                            case 'accounting_business_plan': return <BusinessPlanPage allUsers={allUsers} />;
                            case 'approval_list': return <ApprovalWorkflowPage currentUser={currentUser} view="list" searchTerm={searchTerm} addToast={addToast} onRefreshData={() => loadData(currentUser)} />;
                            case 'approval_form_expense':
                            case 'approval_form_transport':
                            case 'approval_form_leave':
                            case 'approval_form_approval':
                            case 'approval_form_daily':
                            case 'approval_form_weekly':
                                return <ApprovalWorkflowPage currentUser={currentUser} view="form" formCode={currentPage.split('_').pop()?.toUpperCase()} addToast={addToast} customers={customers} accountItems={accountItems} jobs={jobs} purchaseOrders={purchaseOrders} departments={departments} isAIOff={isAIOff} allocationDivisions={allocationDivisions} onSuccess={() => {loadData(currentUser); handleNavigate('approval_list')}} />;
                            case 'business_support_proposal': return <BusinessSupportPage customers={customers} jobs={jobs} estimates={estimates} currentUser={currentUser} addToast={addToast} isAIOff={isAIOff} />;
                            case 'ai_business_consultant': return <AIChatPage currentUser={currentUser} jobs={jobs} customers={customers} journalEntries={journalEntries} />;
                            case 'ai_market_research': return <MarketResearchPage addToast={addToast} isAIOff={isAIOff} />;
                            case 'ai_live_chat': return <LiveChatPage isAIOff={isAIOff} addToast={addToast} />;
                            case 'ai_anything_analysis': return <AnythingAnalysisPage currentUser={currentUser} addToast={addToast} isAIOff={isAIOff} />;
                            case 'manufacturing_cost': return <ManufacturingCostManagement jobs={jobs} />;
                            case 'admin_audit_log': return <AuditLogPage />;
                            case 'admin_journal_queue': return <JournalQueuePage />;
                            case 'admin_master_management': return <MasterManagementPage accountItems={accountItems} paymentRecipients={paymentRecipients} allocationDivisions={allocationDivisions} departments={departments} titles={titles} onSaveAccountItem={async (item) => {await dataService.saveAccountItem(item); loadData(currentUser);}} onDeleteAccountItem={async (id) => {await dataService.deactivateAccountItem(id); loadData(currentUser);}} onSavePaymentRecipient={async (item) => {await dataService.savePaymentRecipient(item); loadData(currentUser);}} onDeletePaymentRecipient={async (id) => {await dataService.deletePaymentRecipient(id); loadData(currentUser);}} onSaveAllocationDivision={async (item) => {await dataService.saveAllocationDivision(item); loadData(currentUser);}} onDeleteAllocationDivision={async (id) => {await dataService.deleteAllocationDivision(id); loadData(currentUser);}} onSaveDepartment={async (item) => {await dataService.saveDepartment(item); loadData(currentUser);}} onDeleteDepartment={async (id) => {await dataService.deleteDepartment(id); loadData(currentUser);}} onSaveTitle={async (item) => {await dataService.saveTitle(item); loadData(currentUser);}} onDeleteTitle={async (id) => {await dataService.deleteTitle(id); loadData(currentUser);}} addToast={addToast} requestConfirmation={requestConfirmation} />;
                            case 'hr_org_chart': return <OrganizationChartPage employees={employees} />;
                            default: return <PlaceholderPage title={PAGE_TITLES[currentPage] || currentPage} />;
                        }
                    })()}
                </div>
            </main>
            <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(ts => ts.filter(t => t.id !== id))} />
            <ConfirmationDialog {...confirmationDialog} />
            {isCreateJobModalOpen && <CreateJobModal isOpen={isCreateJobModalOpen} onClose={() => setIsCreateJobModalOpen(false)} onAddJob={async (job) => { await dataService.addJob(job); loadData(currentUser); }} />}
            {selectedJob && <JobDetailModal isOpen={!!selectedJob} job={selectedJob} onClose={() => setSelectedJob(null)} onUpdateJob={async (id, data) => {await dataService.updateJob(id, data); loadData(currentUser);}} onDeleteJob={async (id) => {await dataService.deleteJob(id); loadData(currentUser); setSelectedJob(null);}} requestConfirmation={requestConfirmation} onNavigate={handleNavigate} addToast={addToast} />}
            {(customerModalMode === 'view' || customerModalMode === 'edit') && selectedCustomer && <CustomerDetailModal customer={selectedCustomer} mode={customerModalMode} onClose={() => setSelectedCustomer(null)} onSave={async (data) => {await dataService.updateCustomer(selectedCustomer.id, data); loadData(currentUser); setSelectedCustomer(null);}} onSetMode={setCustomerModalMode} onAnalyzeCustomer={handleAnalyzeCustomer} isAIOff={isAIOff} />}
            {customerModalMode === 'new' && <CustomerDetailModal customer={null} mode="new" onClose={() => setCustomerModalMode('view')} onSave={async (data) => {await dataService.addCustomer(data); loadData(currentUser); setCustomerModalMode('view');}} onSetMode={setCustomerModalMode} onAnalyzeCustomer={handleAnalyzeCustomer} isAIOff={isAIOff} />}
            {isCompanyAnalysisModalOpen && <CompanyAnalysisModal isOpen={isCompanyAnalysisModalOpen} onClose={() => setIsCompanyAnalysisModalOpen(false)} analysis={companyAnalysis} customer={analysisTargetCustomer} isLoading={isAnalysisLoading} error={analysisError} currentUser={currentUser} isAIOff={isAIOff} onReanalyze={handleReanalyze} />}
            {isCreateLeadModalOpen && <CreateLeadModal isOpen={isCreateLeadModalOpen} onClose={() => setIsCreateLeadModalOpen(false)} onAddLead={async (lead) => {await dataService.addLead(lead); loadData(currentUser);}} />}
            {isCreateInventoryItemModalOpen && <CreateInventoryItemModal isOpen={isCreateInventoryItemModalOpen} onClose={() => setIsCreateInventoryItemModalOpen(false)} onSave={async (item) => {if(item.id){await dataService.updateInventoryItem(item.id, item)}else{await dataService.addInventoryItem(item as any)} loadData(currentUser);}} item={null} />}
            {isCreatePurchaseOrderModalOpen && <CreatePurchaseOrderModal isOpen={isCreatePurchaseOrderModalOpen} onClose={() => setIsCreatePurchaseOrderModalOpen(false)} onAddPurchaseOrder={async (order) => {await dataService.addPurchaseOrder(order); loadData(currentUser);}} />}
            
            {isBugReportModalOpen && <BugReportModal 
              isOpen={isBugReportModalOpen} 
              onClose={() => setIsBugReportModalOpen(false)} 
              currentUser={currentUser} 
              onReportSubmit={async (report) => {
                await dataService.addBugReport(report);
                addToast('ご報告ありがとうございます。', 'success');
                setIsBugReportModalOpen(false);
              }} 
            />}
            
            {showSetup && <DatabaseSetupInstructionsModal onRetry={() => {setShowSetup(false); if(currentUser) loadData(currentUser); }} />}

            <button
                onClick={() => setIsBugReportModalOpen(true)}
                className="fixed bottom-8 right-8 z-[100] bg-purple-600 text-white p-4 rounded-full shadow-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75 transition-transform transform hover:scale-110"
                title="改善要望を送信"
            >
                <Bug className="w-6 h-6" />
            </button>
        </div>
    );
};

export default App;