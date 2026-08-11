package com.logistics.handheld.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.logistics.handheld.core.database.OutboxEventEntity
import com.logistics.handheld.core.location.LocationProvider
import com.logistics.handheld.core.model.Bootstrap
import com.logistics.handheld.core.model.HandheldAction
import com.logistics.handheld.core.model.IdentifierKind
import com.logistics.handheld.core.model.OperationalContext
import com.logistics.handheld.core.model.PackageSummary
import com.logistics.handheld.core.model.TaskType
import com.logistics.handheld.core.model.WorkSession
import com.logistics.handheld.core.model.WorkflowCatalog
import com.logistics.handheld.core.network.NetworkMonitor
import com.logistics.handheld.core.repository.AuthRepository
import com.logistics.handheld.core.repository.CaptureRequest
import com.logistics.handheld.core.repository.WorkRepository
import com.logistics.handheld.core.repository.toDomain
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class HandheldRoute { LOGIN, HOME, WORK, HISTORY }
enum class ScannerTarget { BADGE, IDENTIFIER, CONTAINER, TRAILER, LOOKUP }

data class HandheldUiState(
    val route: HandheldRoute = HandheldRoute.LOGIN,
    val bootstrap: Bootstrap? = null,
    val activeSessions: List<WorkSession> = emptyList(),
    val currentSession: WorkSession? = null,
    val selectedAction: HandheldAction? = null,
    val context: OperationalContext = OperationalContext(),
    val identifier: String = "",
    val pairedContainerBarcode: String = "",
    val badge: String = "",
    val employeeNumber: String = "",
    val deviceId: String = "",
    val deviceCredential: String = "",
    val deviceEnrolled: Boolean = false,
    val configuringDevice: Boolean = false,
    val lookupInput: String = "",
    val packageSummary: PackageSummary? = null,
    val scannerTarget: ScannerTarget? = null,
    val online: Boolean = false,
    val events: List<OutboxEventEntity> = emptyList(),
    val busy: Boolean = true,
    val error: String? = null,
    val notice: String? = null,
)

@HiltViewModel
class HandheldViewModel @Inject constructor(
    private val auth: AuthRepository,
    private val work: WorkRepository,
    private val network: NetworkMonitor,
    private val location: LocationProvider,
) : ViewModel() {
    private val mutableState = MutableStateFlow(HandheldUiState())
    val state: StateFlow<HandheldUiState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch {
            network.isOnline.collect { online ->
                mutableState.update { it.copy(online = online) }
            }
        }
        viewModelScope.launch {
            work.events.collect { events ->
                mutableState.update { it.copy(events = events) }
            }
        }
        viewModelScope.launch {
            work.activeSessions.collect { entities ->
                val sessions = entities.map { it.toDomain() }
                mutableState.update { current ->
                    val selected = current.currentSession
                        ?.let { selectedSession -> sessions.find { it.id == selectedSession.id } }
                        ?: current.currentSession
                    current.copy(activeSessions = sessions, currentSession = selected)
                }
            }
        }
        loadAuthenticatedShift()
    }

    fun setBadge(value: String) = mutableState.update { it.copy(badge = value) }
    fun setEmployeeNumber(value: String) = mutableState.update { it.copy(employeeNumber = value) }
    fun setDeviceCredential(value: String) = mutableState.update { it.copy(deviceCredential = value) }
    fun setIdentifier(value: String) = mutableState.update { it.copy(identifier = value) }
    fun setContainer(value: String) = mutableState.update { it.copy(pairedContainerBarcode = value) }
    fun setLookup(value: String) = mutableState.update { it.copy(lookupInput = value) }

    fun configureDevice() = mutableState.update { it.copy(configuringDevice = true) }

    fun saveDeviceEnrollment() = runBusy {
        val credential = mutableState.value.deviceCredential
        auth.saveDeviceCredential(credential)
        mutableState.update {
            it.copy(
                deviceCredential = "",
                deviceEnrolled = true,
                configuringDevice = false,
                notice = "Device credential stored securely.",
            )
        }
    }

    fun setContext(context: OperationalContext) {
        mutableState.update { it.copy(context = context) }
        mutableState.value.currentSession?.let { session ->
            viewModelScope.launch { work.updateContext(session.id, context) }
        }
    }

    fun navigate(route: HandheldRoute) {
        mutableState.update {
            it.copy(
                route = route,
                error = null,
                notice = null,
                scannerTarget = null,
            )
        }
    }

    fun login() = runBusy {
        val current = mutableState.value
        require(current.badge.isNotBlank()) { "Scan or enter a badge." }
        require(current.employeeNumber.isNotBlank()) { "Enter an employee number." }
        val bootstrap = auth.login(current.badge, current.employeeNumber)
        mutableState.update {
            it.copy(
                bootstrap = bootstrap,
                activeSessions = bootstrap.activeSessions,
                badge = "",
                employeeNumber = "",
                route = HandheldRoute.HOME,
                notice = "Signed in at ${bootstrap.terminal.terminalCode}.",
            )
        }
    }

    fun logout() = runBusy {
        auth.logout()
        val current = mutableState.value
        mutableState.value = HandheldUiState(
            online = current.online,
            deviceId = current.deviceId,
            deviceEnrolled = current.deviceEnrolled,
            busy = false,
        )
    }

    fun openTask(taskType: TaskType) = runBusy {
        val current = mutableState.value
        val existing = current.activeSessions.firstOrNull { it.taskType == taskType }
        val session = existing ?: work.startSession(
            taskType,
            requireNotNull(current.bootstrap).employee.id,
        )
        val definition = WorkflowCatalog.task(taskType)
        mutableState.update {
            it.copy(
                route = HandheldRoute.WORK,
                currentSession = session,
                selectedAction = definition.actions.first().action,
                context = work.context(session.id),
                identifier = "",
                pairedContainerBarcode = "",
                notice = if (existing == null) "Task session started." else "Task session resumed.",
            )
        }
    }

    fun selectAction(action: HandheldAction) {
        mutableState.update {
            it.copy(
                selectedAction = action,
                identifier = "",
                error = null,
                notice = null,
            )
        }
    }

    fun transition(action: String) = runBusy {
        val session = requireNotNull(mutableState.value.currentSession)
        val updated = work.transition(session, action)
        mutableState.update {
            it.copy(
                currentSession = updated,
                route = if (action == "complete") HandheldRoute.HOME else it.route,
                notice = "Session ${action}d.",
            )
        }
        if (action == "complete") refreshBootstrap()
    }

    fun capture() = runBusy {
        val current = mutableState.value
        val session = requireNotNull(current.currentSession)
        val action = requireNotNull(current.selectedAction)
        val definition = WorkflowCatalog.task(session.taskType).actions.first { it.action == action }
        if (definition.identifierKind != IdentifierKind.NONE) {
            require(current.identifier.isNotBlank()) { "Scan or enter the required identifier." }
        }
        if (definition.needsContainer && definition.identifierKind != IdentifierKind.CONTAINER) {
            require(current.pairedContainerBarcode.isNotBlank()) { "Scan or enter a container." }
        }
        if (definition.needsTrailer) {
            require(current.context.trailerBarcode.isNotBlank()) { "Scan or enter a trailer." }
        }
        if (definition.needsRouteAndTruck) {
            require(current.context.routeCode.isNotBlank()) { "Enter a route." }
            require(current.context.truckUnitNumber.isNotBlank()) { "Enter a truck unit." }
        }

        val event = work.capture(
            CaptureRequest(
                session = session,
                action = action,
                identifier = current.identifier,
                pairedContainerBarcode = current.pairedContainerBarcode,
                context = current.context,
                location = if (definition.capturesLocation) location.current() else null,
            ),
        )
        mutableState.update {
            it.copy(
                identifier = "",
                pairedContainerBarcode = "",
                notice = event.message,
                // Return to the camera for the next label in continuous mode.
                scannerTarget = if (definition.identifierKind == IdentifierKind.NONE) {
                    null
                } else {
                    ScannerTarget.IDENTIFIER
                },
            )
        }
    }

    fun reverse(event: OutboxEventEntity) = runBusy {
        val reversal = work.reverse(event)
        mutableState.update { it.copy(notice = reversal.message) }
    }

    fun dismiss(event: OutboxEventEntity) = runBusy {
        work.dismissRejected(event.clientEventId)
        mutableState.update { it.copy(notice = "Rejected item dismissed from action required.") }
    }

    fun synchronize() {
        work.synchronize()
        mutableState.update { it.copy(notice = "Synchronization requested.") }
    }

    fun lookup() = runBusy {
        val value = mutableState.value.lookupInput
        require(value.isNotBlank()) { "Scan or enter a tracking number." }
        val summary = work.packageLookup(value)
        mutableState.update { it.copy(packageSummary = summary) }
    }

    fun openScanner(target: ScannerTarget) {
        mutableState.update { it.copy(scannerTarget = target, error = null, notice = null) }
    }

    fun closeScanner() {
        mutableState.update { it.copy(scannerTarget = null) }
    }

    fun barcodeScanned(value: String) {
        val target = mutableState.value.scannerTarget ?: return
        mutableState.update {
            when (target) {
                ScannerTarget.BADGE -> it.copy(badge = value, scannerTarget = null)
                ScannerTarget.IDENTIFIER -> it.copy(identifier = value, scannerTarget = null)
                ScannerTarget.CONTAINER -> it.copy(pairedContainerBarcode = value, scannerTarget = null)
                ScannerTarget.TRAILER -> it.copy(
                    context = it.context.copy(trailerBarcode = value),
                    scannerTarget = null,
                )
                ScannerTarget.LOOKUP -> it.copy(lookupInput = value, scannerTarget = null)
            }
        }
        if (target == ScannerTarget.TRAILER) setContext(mutableState.value.context)
        if (target == ScannerTarget.IDENTIFIER) {
            val current = mutableState.value
            val session = current.currentSession
            val definition = session?.let {
                WorkflowCatalog.task(it.taskType).actions.firstOrNull { action ->
                    action.action == current.selectedAction
                }
            }
            if (
                definition?.needsContainer == true &&
                definition.identifierKind != IdentifierKind.CONTAINER
            ) {
                openScanner(ScannerTarget.CONTAINER)
            } else {
                capture()
            }
        }
        if (target == ScannerTarget.CONTAINER && mutableState.value.identifier.isNotBlank()) capture()
        if (target == ScannerTarget.LOOKUP) lookup()
    }

    fun clearMessage() {
        mutableState.update { it.copy(error = null, notice = null) }
    }

    private fun loadAuthenticatedShift() = runBusy {
        val deviceId = auth.deviceId()
        val deviceEnrolled = auth.isDeviceEnrolled()
        val bootstrap = auth.bootstrap()
        mutableState.update {
            it.copy(
                deviceId = deviceId,
                deviceEnrolled = deviceEnrolled,
                configuringDevice = !deviceEnrolled,
                bootstrap = bootstrap,
                activeSessions = bootstrap?.activeSessions.orEmpty(),
                route = if (bootstrap == null) HandheldRoute.LOGIN else HandheldRoute.HOME,
            )
        }
    }

    private suspend fun refreshBootstrap() {
        val bootstrap = auth.bootstrap()
        mutableState.update {
            it.copy(
                bootstrap = bootstrap,
                activeSessions = bootstrap?.activeSessions.orEmpty(),
            )
        }
    }

    private fun runBusy(block: suspend () -> Unit) {
        viewModelScope.launch {
            mutableState.update { it.copy(busy = true, error = null, notice = null) }
            runCatching { block() }
                .onFailure { failure ->
                    mutableState.update {
                        it.copy(error = failure.message ?: "The operation could not be completed.")
                    }
                }
            mutableState.update { it.copy(busy = false) }
        }
    }
}
