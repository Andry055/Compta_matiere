import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "./ui/sidebar"
import { 
  LayoutDashboard, 
  ArrowUpDown, 
  List, 
  Users, 
  Settings,
  Package,
  BookOpen
} from "lucide-react"

const items = [
  {
    title: "Tableau de Bord",
    url: "#",
    icon: LayoutDashboard,
    isActive: true,
  },
  {
    title: "Journal Comptable",
    url: "#",
    icon: BookOpen,
  },
  {
    title: "Mouvements",
    url: "#",
    icon: ArrowUpDown,
  },
  {
    title: "Nomenclature",
    url: "#",
    icon: List,
  },
  {
    title: "Fournisseurs",
    url: "#",
    icon: Users,
  },
  {
    title: "Paramètres",
    url: "#",
    icon: Settings,
  },
]

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-4 py-2">
          <Package className="h-6 w-6 text-primary" />
          <span className="text-sidebar-foreground">ComptaMatière</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.isActive}
                  >
                    <a href={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}