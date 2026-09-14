import React from "react";
import {
  Building2,
  Briefcase,
  Users,
  ChevronDown,
  ChevronRight,
  Edit,
  Trash2,
  UserPlus,
  Loader2,
  Crown,
  ArrowRightLeft,
} from "lucide-react";

interface Employee {
  id: number;
  name: string;
  im: string;
  fonction: string;
  email: string;
  phone: string;
  CIN: string;
  status: "Actif" | "Inactif" | "Congé";
}

interface Service {
  id: number;
  name: string;
  manager: string;
  managerEmail: string;
  description: string;
  employees: Employee[];
  location: string;
}

interface Direction {
  id: number;
  name: string;
  director: string;
  directorEmail: string;
  description: string;
  services: Service[];
  location: string;
  isCurrentAdminDirection?: boolean;
}

interface DirectionsStructureProps {
  directions: Direction[];
  expandedDirection: number | null;
  expandedService: number | null;
  onDirectionToggle: (directionId: number) => void;
  onServiceToggle: (serviceId: number) => void;
  onAddEmployee: (serviceId: number) => void;
  onEditEmployee?: (employee: Employee, serviceId: number) => void;
  onTransferEmployee?: (employee: Employee) => void;
  onEditDirection?: (direction: Direction) => void;
  addingEmployees: { [key: number]: boolean };
  getStatusColor: (status: string) => string;
}

export function DirectionsStructure({
  directions,
  expandedDirection,
  expandedService,
  onDirectionToggle,
  onServiceToggle,
  onAddEmployee,
  onEditEmployee,
  onTransferEmployee,
  onEditDirection,
  addingEmployees,
  getStatusColor,
}: DirectionsStructureProps) {
  return (
    <div className="space-y-4">
      {directions.map((direction) => (
        <div
          key={direction.id}
          className={`bg-card border border-border rounded-lg shadow-sm ${
            direction.isCurrentAdminDirection
              ? "ring-2 ring-blue-200 dark:ring-blue-800 bg-blue-50/30 dark:bg-blue-900/10"
              : ""
          }`}
        >
          {/* Direction Header */}
          <div
            className="p-6 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => onDirectionToggle(direction.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {expandedDirection === direction.id ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div className="relative">
                    <Building2 className="h-6 w-6 text-primary" />
                    {direction.isCurrentAdminDirection && (
                      <Crown className="h-3 w-3 text-yellow-500 absolute -top-1 -right-1" />
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg text-card-foreground">
                      {direction.name}
                    </h3>
                    {direction.isCurrentAdminDirection && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full dark:bg-blue-900/30 dark:text-blue-300">
                        Votre Direction
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {direction.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Directeur: {direction.director}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="text-center">
                  <div className="text-lg text-card-foreground">
                    {direction.services.length}
                  </div>
                  <div>Services</div>
                </div>
                <div className="text-center">
                  <div className="text-lg text-card-foreground">
                    {direction.services.reduce(
                      (sum, service) => sum + service.employees.length,
                      0
                    )}
                  </div>
                  <div>Employés</div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditDirection?.(direction);
                    }}
                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                    title="Modifier la direction"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-red-600"
                    title="Supprimer la direction"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Expanded Direction Details */}
          {expandedDirection === direction.id && (
            <div className="border-t border-border">
              <div className="p-6 bg-muted/20">
                <div className="grid gap-6 md:grid-cols-2 mb-6">
                  <div>
                    <h4 className="text-sm text-muted-foreground mb-2">
                      Directeur
                    </h4>
                    <div className="text-card-foreground">
                      {direction.director}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {direction.directorEmail}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm text-muted-foreground mb-2">
                      Localisation
                    </h4>
                    <div className="text-card-foreground">
                      {direction.location}
                    </div>
                  </div>
                </div>

                {/* Services List */}
                <div>
                  <h4 className="text-lg text-card-foreground mb-4">
                    Services ({direction.services.length})
                  </h4>
                  <div className="space-y-3">
                    {direction.services.map((service) => (
                      <div
                        key={service.id}
                        className="bg-background border border-border rounded-lg"
                      >
                        <div
                          className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => onServiceToggle(service.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                {expandedService === service.id ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <Briefcase className="h-5 w-5 text-orange-600" />
                              </div>
                              <div>
                                <h5 className="text-card-foreground">
                                  {service.name}
                                </h5>
                                <p className="text-xs text-muted-foreground">
                                  {service.description}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Responsable: {service.manager}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="text-center">
                                <div className="text-card-foreground">
                                  {service.employees.length}
                                </div>
                                <div className="text-xs">Employés</div>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAddEmployee(service.id);
                                  }}
                                  disabled={addingEmployees[service.id]}
                                  className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-blue-600 disabled:opacity-50"
                                >
                                  {addingEmployees[service.id] ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <UserPlus className="h-3 w-3" />
                                  )}
                                </button>
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                                >
                                  <Edit className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-red-600"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Service Details - Employee List */}
                        {expandedService === service.id && (
                          <div className="border-t border-border p-4 bg-muted/10">
                            <div className="flex items-center justify-between mb-4">
                              <h6 className="text-card-foreground">
                                Personnel du Service ({service.employees.length}
                                )
                              </h6>
                              <div className="text-xs text-muted-foreground">
                                {service.location}
                              </div>
                            </div>

                            {service.employees.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-border">
                                      <th className="text-left py-2 px-2 text-xs text-muted-foreground">
                                        IM
                                      </th>
                                      <th className="text-left py-2 px-2 text-xs text-muted-foreground">
                                        Nom
                                      </th>
                                      <th className="text-left py-2 px-2 text-xs text-muted-foreground">
                                        Fonction
                                      </th>
                                      <th className="text-left py-2 px-2 text-xs text-muted-foreground">
                                        Email
                                      </th>
                                      <th className="text-left py-2 px-2 text-xs text-muted-foreground">
                                        Téléphone
                                      </th>
                                      <th className="text-left py-2 px-2 text-xs text-muted-foreground">
                                        Statut
                                      </th>
                                      <th className="text-left py-2 px-2 text-xs text-muted-foreground">
                                        Actions
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {service.employees.map((employee) => (
                                      <tr
                                        key={employee.id}
                                        className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                                      >
                                        <td className="py-2 px-2 text-xs text-card-foreground">
                                          {employee.im}
                                        </td>
                                        <td className="py-2 px-2 text-xs text-card-foreground">
                                          {employee.name}
                                        </td>
                                        <td className="py-2 px-2 text-xs text-card-foreground">
                                          {employee.fonction}
                                        </td>
                                        <td className="py-2 px-2 text-xs text-card-foreground">
                                          {employee.email}
                                        </td>
                                        <td className="py-2 px-2 text-xs text-card-foreground">
                                          {employee.phone}
                                        </td>
                                        <td className="py-2 px-2">
                                          <span
                                            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs ${getStatusColor(
                                              employee.status
                                            )}`}
                                          >
                                            {employee.status}
                                          </span>
                                        </td>
                                        <td className="py-2 px-2">
                                          <div className="flex items-center gap-1">
                                            <button
                                              onClick={() =>
                                                onEditEmployee?.(
                                                  employee,
                                                  service.id
                                                )
                                              }
                                              className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                                              title="Modifier l'employé"
                                            >
                                              <Edit className="h-3 w-3" />
                                            </button>
                                            <button
                                              onClick={() =>
                                                onTransferEmployee?.(employee)
                                              }
                                              className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-blue-600"
                                              title="Transférer l'employé"
                                            >
                                              <ArrowRightLeft className="h-3 w-3" />
                                            </button>
                                            <button
                                              className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-red-600"
                                              title="Supprimer l'employé"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-center py-4 text-muted-foreground text-sm">
                                Aucun employé dans ce service
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
