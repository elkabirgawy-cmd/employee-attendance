import { useState } from 'react';
import { AlertCircle, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface BranchDebugPanelProps {
  authUid: string | null;
  employee: {
    id: string;
    company_id: string;
    branch_id: string;
    full_name: string;
  } | null;
  branch: {
    id: string;
    company_id: string;
    name: string;
    latitude: number;
    longitude: number;
    geofence_radius: number;
    updated_at: string;
  } | null;
  location: {
    lat: number;
    lng: number;
  } | null;
  distance: number | null;
  inRange: boolean | null;
  lastFetchTime: Date | null;
  dataSource: string;
  onRefresh: () => void;
}

export default function BranchDebugPanel({
  authUid,
  employee,
  branch,
  location,
  distance,
  inRange,
  lastFetchTime,
  dataSource,
  onRefresh
}: BranchDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Data integrity checks
  const companyIdMatch = employee && branch ? employee.company_id === branch.company_id : null;
  const branchIdMatch = employee && branch ? employee.branch_id === branch.id : null;

  // Hidden by default - developers can enable with: localStorage.setItem('show_debug_panel', 'true')
  const isDebugEnabled = typeof window !== 'undefined' && localStorage.getItem('show_debug_panel') === 'true';

  return (
    <div className="fixed bottom-4 right-4 z-50" style={{ display: isDebugEnabled ? 'block' : 'none' }}>
      <div className="bg-gray-900 text-white rounded-lg shadow-2xl border border-gray-700 overflow-hidden max-w-md">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-2 flex items-center justify-between bg-gray-800 hover:bg-gray-750 transition-colors"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold">Branch Debug Panel</span>
          </div>
          <div className="flex items-center gap-2">
            {companyIdMatch === false && (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            {companyIdMatch === true && (
              <CheckCircle className="w-4 h-4 text-green-500" />
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </button>

        {/* Content */}
        {isExpanded && (
          <div className="p-4 max-h-96 overflow-y-auto text-xs space-y-3">
            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Force Refresh Branch Data</span>
            </button>

            {/* Auth Info */}
            <div className="bg-gray-800 rounded p-2">
              <div className="font-semibold text-blue-400 mb-1">Authentication</div>
              <div className="space-y-1">
                <div>auth.uid(): <span className="text-yellow-300">{authUid || 'NULL'}</span></div>
              </div>
            </div>

            {/* Employee Info */}
            <div className="bg-gray-800 rounded p-2">
              <div className="font-semibold text-green-400 mb-1">Employee Context</div>
              {employee ? (
                <div className="space-y-1">
                  <div>ID: <span className="text-yellow-300">{employee.id}</span></div>
                  <div>Name: <span className="text-yellow-300">{employee.full_name}</span></div>
                  <div>Company ID: <span className="text-yellow-300">{employee.company_id}</span></div>
                  <div>Branch ID: <span className="text-yellow-300">{employee.branch_id}</span></div>
                </div>
              ) : (
                <div className="text-red-400">No employee data</div>
              )}
            </div>

            {/* Branch Info */}
            <div className="bg-gray-800 rounded p-2">
              <div className="font-semibold text-purple-400 mb-1">Branch Data</div>
              {branch ? (
                <div className="space-y-1">
                  <div>ID: <span className="text-yellow-300">{branch.id}</span></div>
                  <div>Name: <span className="text-yellow-300">{branch.name}</span></div>
                  <div>Company ID: <span className="text-yellow-300">{branch.company_id}</span></div>
                  <div>Latitude: <span className="text-yellow-300">{branch.latitude.toFixed(6)}</span></div>
                  <div>Longitude: <span className="text-yellow-300">{branch.longitude.toFixed(6)}</span></div>
                  <div>Radius: <span className="text-yellow-300">{branch.geofence_radius}m</span></div>
                  <div>Updated: <span className="text-yellow-300">{new Date(branch.updated_at).toLocaleString()}</span></div>
                </div>
              ) : (
                <div className="text-red-400">No branch data</div>
              )}
            </div>

            {/* Data Source */}
            <div className="bg-gray-800 rounded p-2">
              <div className="font-semibold text-cyan-400 mb-1">Data Source</div>
              <div>Function: <span className="text-yellow-300">{dataSource}</span></div>
              <div>Last Fetch: <span className="text-yellow-300">
                {lastFetchTime ? lastFetchTime.toLocaleTimeString() : 'Never'}
              </span></div>
            </div>

            {/* GPS Info */}
            <div className="bg-gray-800 rounded p-2">
              <div className="font-semibold text-orange-400 mb-1">GPS Validation</div>
              {location ? (
                <div className="space-y-1">
                  <div>Employee Lat: <span className="text-yellow-300">{location.lat.toFixed(6)}</span></div>
                  <div>Employee Lng: <span className="text-yellow-300">{location.lng.toFixed(6)}</span></div>
                  <div>Distance: <span className="text-yellow-300">{distance !== null ? `${Math.round(distance)}m` : 'N/A'}</span></div>
                  <div>In Range: {inRange !== null ? (
                    inRange ? (
                      <span className="text-green-400 flex items-center gap-1 inline-flex">
                        <CheckCircle className="w-3 h-3" /> YES
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1 inline-flex">
                        <XCircle className="w-3 h-3" /> NO
                      </span>
                    )
                  ) : (
                    <span className="text-gray-400">N/A</span>
                  )}</div>
                </div>
              ) : (
                <div className="text-red-400">No GPS data</div>
              )}
            </div>

            {/* Data Integrity Checks */}
            <div className="bg-gray-800 rounded p-2">
              <div className="font-semibold text-red-400 mb-1">Data Integrity</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {companyIdMatch === true ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : companyIdMatch === false ? (
                    <XCircle className="w-4 h-4 text-red-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-gray-500" />
                  )}
                  <span>Company ID Match: {
                    companyIdMatch === true ? 'PASS' :
                    companyIdMatch === false ? 'FAIL - DATA CORRUPTION!' :
                    'N/A'
                  }</span>
                </div>
                <div className="flex items-center gap-2">
                  {branchIdMatch === true ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : branchIdMatch === false ? (
                    <XCircle className="w-4 h-4 text-red-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-gray-500" />
                  )}
                  <span>Branch ID Match: {
                    branchIdMatch === true ? 'PASS' :
                    branchIdMatch === false ? 'FAIL - DATA CORRUPTION!' :
                    'N/A'
                  }</span>
                </div>
              </div>
            </div>

            {/* Warning if data integrity fails */}
            {(companyIdMatch === false || branchIdMatch === false) && (
              <div className="bg-red-900 border border-red-500 rounded p-2">
                <div className="font-semibold text-red-200 mb-1 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  DATA INTEGRITY ERROR
                </div>
                <div className="text-red-200 text-xs">
                  Branch data does not match employee context. This indicates a serious data corruption issue.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
