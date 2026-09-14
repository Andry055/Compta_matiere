import { StaffSidebar } from "./StaffSidebar"
import { StaffDashboard } from "./StaffDashboard"
import { MaterialEntry } from "./MaterialEntry"
import { MaterialExit } from "./MaterialExit"
import { MyMovements } from "./MyMovements"
import { PendingRequests } from "./PendingRequests"
import { StaffProfile } from "./StaffProfile"
import { ThemeToggle } from "./ThemeToggle"
import { Menu, Package, Bell, LogOut, X } from "lucide-react"
import { useState, useEffect } from "react"
import { User } from "../App"

interface StaffDashboardLayoutProps {
  user: User
  onLogout: () => void
}

export function StaffDashboardLayout({ user, onLogout }: StaffDashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState("dashboard")
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024)
      if (window.innerWidth < 1024) {
        setSidebarOpen(false)
      } else {
        setSidebarOpen(true)
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return <StaffDashboard user={user} />
      case "entry":
        return <MaterialEntry user={user} />
      case "exit":
        return <MaterialExit user={user} />
      case "movements":
        return <MyMovements user={user} />
      case "requests":
        return <PendingRequests user={user} />
      case "profile":
        return <StaffProfile user={user} />
      default:
        return <StaffDashboard user={user} />
    }
  }

  const handleSectionChange = (section: string) => {
    setActiveSection(section)
    if (isMobile) {
      setMobileMenuOpen(false)
    }
  }

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Mobile Overlay */}
      {isMobile && mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        ${isMobile ? "fixed" : "relative"}
        ${isMobile && !mobileMenuOpen ? "-translate-x-full" : "translate-x-0"}
        ${isMobile ? "z-50" : ""}
        ${!isMobile && !sidebarOpen ? "-translate-x-full" : ""}
        transition-transform duration-300 ease-in-out
        ${isMobile ? "w-80" : ""}
      `}
      >
        <StaffSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          user={user}
          isMobile={isMobile}
          onClose={() => setMobileMenuOpen(false)}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between p-3 sm:p-4 border-b border-border bg-background shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => {
                if (isMobile) {
                  setMobileMenuOpen(!mobileMenuOpen);
                } else {
                  setSidebarOpen(!sidebarOpen);
                }
              }}
              className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {isMobile && mobileMenuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
              <span className="sr-only">Toggle sidebar</span>
            </button>
            {(!sidebarOpen || isMobile) && (
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <span className="text-foreground hidden sm:inline">
                  ComptaMatière
                </span>
              </div>
            )}
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Welcome Message - Hidden on mobile */}
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm text-foreground">
                Bonjour, {user.name.split(" ")[0]}
              </span>
              <span className="text-xs text-muted-foreground">
                {user.department}
              </span>
            </div>

            {/* Notifications */}
            <button className="relative inline-flex items-center justify-center h-9 w-9 rounded-md border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-orange-500 rounded-full text-xs flex items-center justify-center">
                <span className="text-white text-[10px]">2</span>
              </span>
              <span className="sr-only">Notifications</span>
            </button>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Logout */}
            <button
              onClick={onLogout}
              className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-border bg-background hover:bg-destructive hover:text-destructive-foreground transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Se déconnecter</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">{renderContent()}</main>

        {/* Status Bar - Hidden on mobile */}
        <footer className="border-t border-border bg-background px-4 sm:px-6 py-2 shrink-0 hidden sm:block">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <div>Session: {user.name}</div>
              <div className="hidden md:block">
                Direction: {user.department}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden lg:block">Personnel - Accès Limité</div>
              <div className="hidden xl:block">© 2025 ComptaMatière</div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}