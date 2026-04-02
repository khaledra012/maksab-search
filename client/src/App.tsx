import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Suspense, lazy } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SearchProvider } from "./contexts/SearchContext";

const Layout = lazy(() => import("./components/Layout"));
const AdminGuard = lazy(() => import("./components/AdminGuard"));

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Zones = lazy(() => import("./pages/Zones"));
const Leads = lazy(() => import("./pages/Leads"));
const AddLead = lazy(() => import("./pages/AddLead"));
const LeadDetail = lazy(() => import("./pages/LeadDetail"));
const Search = lazy(() => import("./pages/Search"));
const Scout = lazy(() => import("./pages/Scout"));
const SearchEngine = lazy(() => import("./pages/SearchEngine"));
const SearchHub = lazy(() => import("./pages/SearchHub"));
const UsersManagement = lazy(() => import("./pages/UsersManagement"));
const JoinPage = lazy(() => import("./pages/JoinPage"));
const AISettings = lazy(() => import("./pages/AISettings"));
const InterestKeywords = lazy(() => import("./pages/InterestKeywords"));
const Segments = lazy(() => import("./pages/Segments"));
const DataSettings = lazy(() => import("./pages/DataSettings"));
const BulkImport = lazy(() => import("./pages/BulkImport"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const NumberHealth = lazy(() => import("./pages/NumberHealth"));
const EmployeePerformance = lazy(() => import("./pages/EmployeePerformance"));
const DigitalMarketing = lazy(() => import("./pages/DigitalMarketing"));
const Reminders = lazy(() => import("./pages/Reminders"));
const WeeklyReports = lazy(() => import("./pages/WeeklyReports"));
const Activation = lazy(() => import("./pages/Activation"));
const Settings = lazy(() => import("./pages/Settings"));
const Reports = lazy(() => import("./pages/Reports"));
const CompareLeads = lazy(() => import("./pages/CompareLeads"));
const DataQuality = lazy(() => import("./pages/DataQuality"));
const MessagesHub = lazy(() => import("./pages/MessagesHub"));
const SocialAccounts = lazy(() => import("./pages/SocialAccounts"));
const StaffLogin = lazy(() => import("./pages/StaffLogin"));
const SocialCallback = lazy(() => import("./pages/SocialCallback"));
const AcceptInvitation = lazy(() => import("./pages/AcceptInvitation"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const LabelsManager = lazy(() => import("./pages/LabelsManager"));
const FollowUp = lazy(() => import("./pages/FollowUp"));
const AIAgent = lazy(() => import("./pages/AIAgent"));
const SerpQueue = lazy(() => import("./pages/SerpQueue"));
const Seasons = lazy(() => import("./pages/Seasons"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      جاري التحميل...
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/staff-login" component={StaffLogin} />
      <Route path="/accept-invitation" component={AcceptInvitation} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/social-callback" component={SocialCallback} />
      <Route>
        {() => (
          <Layout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/zones" component={Zones} />
              <Route path="/leads" component={Leads} />
              <Route path="/leads/add" component={AddLead} />
              <Route path="/leads/:id" component={LeadDetail} />
              <Route path="/search" component={Search} />
              <Route path="/scout" component={Scout} />
              <Route path="/engine" component={SearchEngine} />
              <Route path="/search-hub" component={SearchHub} />
              <Route path="/users">{() => <AdminGuard><UsersManagement /></AdminGuard>}</Route>
              <Route path="/join" component={JoinPage} />
              <Route path="/ai-settings">{() => <AdminGuard><AISettings /></AdminGuard>}</Route>
              <Route path="/interest-keywords" component={InterestKeywords} />
              <Route path="/segments" component={Segments} />
              <Route path="/data-settings">{() => <AdminGuard><DataSettings /></AdminGuard>}</Route>
              <Route path="/bulk-import" component={BulkImport} />
              <Route path="/knowledge-base" component={KnowledgeBase} />
              <Route path="/number-health" component={NumberHealth} />
              <Route path="/employee-performance" component={EmployeePerformance} />
              <Route path="/digital-marketing" component={DigitalMarketing} />
              <Route path="/reminders" component={Reminders} />
              <Route path="/weekly-reports" component={WeeklyReports} />
              <Route path="/activation" component={Activation} />
              <Route path="/settings" component={Settings} />
              <Route path="/reports" component={Reports} />
              <Route path="/data-quality" component={DataQuality} />
              <Route path="/messages" component={MessagesHub} />
              <Route path="/social-accounts">{() => <AdminGuard><SocialAccounts /></AdminGuard>}</Route>
              <Route path="/audit-log">{() => <AdminGuard><AuditLog /></AdminGuard>}</Route>
              <Route path="/labels" component={LabelsManager} />
              <Route path="/follow-up" component={FollowUp} />
              <Route path="/ai-agent" component={AIAgent} />
              <Route path="/serp-queue" component={SerpQueue} />
              <Route path="/seasons" component={Seasons} />
              <Route path="/compare" component={CompareLeads} />
              <Route path="/404" component={NotFound} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <SearchProvider>
          <TooltipProvider>
            <Toaster />
            <Suspense fallback={<RouteFallback />}>
              <Router />
            </Suspense>
          </TooltipProvider>
        </SearchProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
