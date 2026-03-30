const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex items-center justify-center min-h-[60vh] px-4">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-primary">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">Coming soon</p>
    </div>
  </div>
);

export const CardPage = () => <PlaceholderPage title="My Card" />;
export const PlanPage = () => <PlaceholderPage title="My Plan" />;
export const ResourcesPage = () => <PlaceholderPage title="Resources" />;
export const PassportPage = () => <PlaceholderPage title="Passport" />;
export const CaseloadPage = () => <PlaceholderPage title="Caseload" />;
export const CheckInsPage = () => <PlaceholderPage title="Check-Ins" />;
export const CrpsPage = () => <PlaceholderPage title="My Progress" />;
export const AdminDashboard = () => <PlaceholderPage title="Dashboard" />;
export const AdminParticipants = () => <PlaceholderPage title="Participants" />;
export const AdminPeers = () => <PlaceholderPage title="Peer Specialists" />;
export const AdminContent = () => <PlaceholderPage title="Content" />;
export const AdminReports = () => <PlaceholderPage title="Reports" />;
export const AdminAudit = () => <PlaceholderPage title="Audit Log" />;
export const IntakePage = () => <PlaceholderPage title="Walk-In Intake" />;
