package com.logistics.handheld.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.logistics.handheld.core.database.OutboxEventEntity
import com.logistics.handheld.core.model.ActionDefinition
import com.logistics.handheld.core.model.IdentifierKind
import com.logistics.handheld.core.model.OperationalContext
import com.logistics.handheld.core.model.SessionState
import com.logistics.handheld.core.model.SyncState
import com.logistics.handheld.core.model.TaskDefinition
import com.logistics.handheld.core.model.WorkflowCatalog
import com.logistics.handheld.ui.scanner.CameraScanner

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HandheldApp(viewModel: HandheldViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val scannerTarget = state.scannerTarget
    if (scannerTarget != null) {
        CameraScanner(
            title = scannerTitle(scannerTarget),
            onBarcode = viewModel::barcodeScanned,
            onBack = viewModel::closeScanner,
        )
        return
    }

    if (state.route == HandheldRoute.LOGIN) {
        LoginScreen(state, viewModel)
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Operations handheld", maxLines = 1)
                        Text(
                            state.bootstrap?.terminal?.let { "${it.terminalCode} · ${it.name}" }.orEmpty(),
                            style = MaterialTheme.typography.labelMedium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                },
                actions = {
                    Icon(
                        if (state.online) Icons.Default.CloudDone else Icons.Default.CloudOff,
                        if (state.online) "Online" else "Offline",
                        tint = if (state.online) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.error,
                    )
                    IconButton(onClick = viewModel::logout, enabled = !state.busy) {
                        Icon(Icons.Default.Logout, "End shift")
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = state.route == HandheldRoute.HOME,
                    onClick = { viewModel.navigate(HandheldRoute.HOME) },
                    icon = { Icon(Icons.Default.Home, "Home") },
                    label = { Text("Home") },
                )
                NavigationBarItem(
                    selected = state.route == HandheldRoute.WORK,
                    enabled = state.currentSession != null,
                    onClick = { viewModel.navigate(HandheldRoute.WORK) },
                    icon = { Icon(Icons.Default.Inventory2, "Work") },
                    label = { Text("Work") },
                )
                NavigationBarItem(
                    selected = state.route == HandheldRoute.HISTORY,
                    onClick = { viewModel.navigate(HandheldRoute.HISTORY) },
                    icon = { Icon(Icons.Default.History, "History") },
                    label = { Text("History") },
                )
            }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            MessageBanner(state.error, state.notice, viewModel::clearMessage)
            when (state.route) {
                HandheldRoute.HOME -> HomeScreen(state, viewModel)
                HandheldRoute.WORK -> WorkScreen(state, viewModel)
                HandheldRoute.HISTORY -> HistoryScreen(state, viewModel)
                HandheldRoute.LOGIN -> Unit
            }
        }
    }
}

@Composable
private fun LoginScreen(state: HandheldUiState, viewModel: HandheldViewModel) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
            .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(24.dp)) {
                Icon(
                    Icons.Default.Badge,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                )
                Text(
                    "Start handheld shift",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 12.dp),
                )
                Text(
                    if (state.online) "Connected to operations" else "Connect to sign in for the first time",
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (state.online) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.error,
                )
                MessageBanner(state.error, state.notice, viewModel::clearMessage)
                OutlinedTextField(
                    value = state.badge,
                    onValueChange = viewModel::setBadge,
                    label = { Text("Badge barcode") },
                    singleLine = true,
                    trailingIcon = {
                        IconButton(onClick = { viewModel.openScanner(ScannerTarget.BADGE) }) {
                            Icon(Icons.Default.QrCodeScanner, "Scan badge")
                        }
                    },
                    modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
                )
                OutlinedTextField(
                    value = state.employeeNumber,
                    onValueChange = viewModel::setEmployeeNumber,
                    label = { Text("Employee number") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
                Button(
                    onClick = viewModel::login,
                    enabled = !state.busy && state.online,
                    modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
                ) {
                    if (state.busy) {
                        CircularProgressIndicator(
                            strokeWidth = 2.dp,
                            modifier = Modifier.height(20.dp).width(20.dp),
                        )
                    } else {
                        Text("Sign in")
                    }
                }
            }
        }
    }
}

@Composable
private fun HomeScreen(state: HandheldUiState, viewModel: HandheldViewModel) {
    val bootstrap = state.bootstrap ?: return
    val tasks = WorkflowCatalog.authorized(bootstrap.authorizedTasks)
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text(
                "Hello, ${bootstrap.employee.firstName}",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "${bootstrap.employee.employeeNumber} · ${bootstrap.employee.roles.joinToString()}",
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Package lookup", style = MaterialTheme.typography.titleMedium)
                    OutlinedTextField(
                        value = state.lookupInput,
                        onValueChange = viewModel::setLookup,
                        label = { Text("Tracking number") },
                        singleLine = true,
                        trailingIcon = {
                            IconButton(onClick = { viewModel.openScanner(ScannerTarget.LOOKUP) }) {
                                Icon(Icons.Default.QrCodeScanner, "Scan package")
                            }
                        },
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    )
                    Button(
                        onClick = viewModel::lookup,
                        enabled = !state.busy,
                        modifier = Modifier.padding(top = 8.dp),
                    ) {
                        Icon(Icons.Default.Search, null)
                        Spacer(Modifier.width(8.dp))
                        Text("Look up")
                    }
                    state.packageSummary?.let { PackageSummaryCard(it) }
                }
            }
        }
        item {
            Text("Authorized work", style = MaterialTheme.typography.titleLarge)
        }
        items(tasks, key = { it.type.name }) { task ->
            TaskCard(
                task = task,
                active = state.activeSessions.any { it.taskType == task.type },
                enabled = !state.busy && (state.online || state.activeSessions.any { it.taskType == task.type }),
                onClick = { viewModel.openTask(task.type) },
            )
        }
    }
}

@Composable
private fun TaskCard(
    task: TaskDefinition,
    active: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Card(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    task.label,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                )
                if (active) AssistChip(onClick = onClick, label = { Text("Resume") })
            }
            Text(task.description, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun WorkScreen(state: HandheldUiState, viewModel: HandheldViewModel) {
    val session = state.currentSession ?: return
    val task = WorkflowCatalog.task(session.taskType)
    val action = task.actions.firstOrNull { it.action == state.selectedAction } ?: task.actions.first()
    val context = LocalContext.current
    val locationPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* GPS is best-effort; capture proceeds even if permission is declined. */ }

    LaunchedEffect(action.capturesLocation) {
        if (
            action.capturesLocation &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            locationPermission.launch(Manifest.permission.ACCESS_FINE_LOCATION)
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(task.label, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text("Session ${session.id.take(8)} · ${session.state.name.replace('_', ' ')}")
            }
            SessionControls(session.state, state.busy, viewModel)
        }

        if (session.state != SessionState.ACTIVE) {
            StatusCard("This session is ${session.state.name.lowercase().replace('_', ' ')}. Resume it to capture work.")
        }

        Text("Action", style = MaterialTheme.typography.titleMedium)
        task.actions.forEach { candidate ->
            AssistChip(
                onClick = { viewModel.selectAction(candidate.action) },
                label = { Text(candidate.label) },
                leadingIcon = if (candidate.action == action.action) {
                    { Icon(Icons.Default.PlayArrow, null) }
                } else null,
            )
        }

        ContextFields(action, state, viewModel)

        if (action.needsContainer && action.identifierKind != IdentifierKind.CONTAINER) {
            ScanField(
                value = state.pairedContainerBarcode,
                onValueChange = viewModel::setContainer,
                label = "Container barcode",
                onScan = { viewModel.openScanner(ScannerTarget.CONTAINER) },
            )
        }
        if (action.identifierKind != IdentifierKind.NONE) {
            ScanField(
                value = state.identifier,
                onValueChange = viewModel::setIdentifier,
                label = if (action.identifierKind == IdentifierKind.PACKAGE) {
                    "Package tracking number"
                } else {
                    "Container barcode"
                },
                onScan = { viewModel.openScanner(ScannerTarget.IDENTIFIER) },
            )
        }

        StatusCard(action.instruction)
        Button(
            onClick = viewModel::capture,
            enabled = !state.busy && session.state == SessionState.ACTIVE,
            modifier = Modifier.fillMaxWidth().height(56.dp),
        ) {
            Icon(
                if (action.identifierKind == IdentifierKind.NONE) Icons.Default.Stop
                else Icons.Default.QrCodeScanner,
                null,
            )
            Spacer(Modifier.width(8.dp))
            Text(if (action.identifierKind == IdentifierKind.NONE) "Confirm ${action.label}" else action.label)
        }
    }
}

@Composable
private fun ContextFields(
    action: ActionDefinition,
    state: HandheldUiState,
    viewModel: HandheldViewModel,
) {
    if (action.needsTrailer) {
        ScanField(
            value = state.context.trailerBarcode,
            onValueChange = {
                viewModel.setContext(state.context.copy(trailerBarcode = it))
            },
            label = "Trailer barcode",
            onScan = { viewModel.openScanner(ScannerTarget.TRAILER) },
        )
    }
    if (action.needsRouteAndTruck) {
        OutlinedTextField(
            value = state.context.routeCode,
            onValueChange = { viewModel.setContext(state.context.copy(routeCode = it)) },
            label = { Text("Route code") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = state.context.truckUnitNumber,
            onValueChange = { viewModel.setContext(state.context.copy(truckUnitNumber = it)) },
            label = { Text("Truck unit number") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun ScanField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    onScan: () -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = true,
        trailingIcon = {
            IconButton(onClick = onScan) {
                Icon(Icons.Default.QrCodeScanner, "Scan $label")
            }
        },
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun SessionControls(
    state: SessionState,
    busy: Boolean,
    viewModel: HandheldViewModel,
) {
    Row {
        when (state) {
            SessionState.ACTIVE -> IconButton(
                onClick = { viewModel.transition("pause") },
                enabled = !busy,
            ) { Icon(Icons.Default.Pause, "Pause session") }
            SessionState.PAUSED, SessionState.INACTIVE_OFFLINE -> IconButton(
                onClick = { viewModel.transition("resume") },
                enabled = !busy,
            ) { Icon(Icons.Default.PlayArrow, "Resume session") }
            SessionState.COMPLETED -> Unit
        }
        if (state != SessionState.COMPLETED) {
            IconButton(
                onClick = { viewModel.transition("complete") },
                enabled = !busy,
            ) { Icon(Icons.Default.Stop, "Complete session") }
        }
    }
}

@Composable
private fun HistoryScreen(state: HandheldUiState, viewModel: HandheldViewModel) {
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Local event history", style = MaterialTheme.typography.headlineSmall)
                val needsAction = state.events.count {
                    it.syncState == SyncState.REJECTED_ACTION_REQUIRED.name
                }
                Text("${state.events.size} events · $needsAction require action")
            }
            FilledTonalButton(onClick = viewModel::synchronize, enabled = state.online) {
                Icon(Icons.Default.Sync, null)
                Spacer(Modifier.width(6.dp))
                Text("Sync")
            }
        }
        HorizontalDivider()
        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (state.events.isEmpty()) {
                item { StatusCard("Captured work will appear here, including offline and rejected events.") }
            }
            items(state.events, key = { it.clientEventId }) { event ->
                EventCard(event, state.busy, viewModel)
            }
        }
    }
}

@Composable
private fun EventCard(
    event: OutboxEventEntity,
    busy: Boolean,
    viewModel: HandheldViewModel,
) {
    val syncState = SyncState.valueOf(event.syncState)
    Card(
        colors = CardDefaults.cardColors(
            containerColor = when (syncState) {
                SyncState.REJECTED_ACTION_REQUIRED -> MaterialTheme.colorScheme.errorContainer
                SyncState.PENDING, SyncState.SYNCING -> MaterialTheme.colorScheme.surfaceVariant
                else -> MaterialTheme.colorScheme.surface
            },
        ),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row {
                Text(
                    event.action.replace('_', ' '),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                )
                Text(syncState.name.replace('_', ' '), style = MaterialTheme.typography.labelSmall)
            }
            Text(
                event.trackingNumber ?: event.containerBarcode ?: "Session action",
                style = MaterialTheme.typography.bodyLarge,
            )
            Text(event.message, style = MaterialTheme.typography.bodySmall)
            if (event.exceptionFlags.isNotBlank()) {
                Text("Flags: ${event.exceptionFlags}", style = MaterialTheme.typography.labelSmall)
            }
            Row(modifier = Modifier.padding(top = 6.dp)) {
                if (syncState in setOf(SyncState.ACCEPTED, SyncState.DUPLICATE_ACCEPTED)) {
                    OutlinedButton(
                        onClick = { viewModel.reverse(event) },
                        enabled = !busy,
                    ) { Text("Reverse") }
                }
                if (syncState == SyncState.REJECTED_ACTION_REQUIRED) {
                    OutlinedButton(
                        onClick = { viewModel.dismiss(event) },
                        enabled = !busy,
                    ) { Text("Dismiss") }
                }
            }
        }
    }
}

@Composable
private fun PackageSummaryCard(summary: com.logistics.handheld.core.model.PackageSummary) {
    Card(modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(summary.trackingNumber, fontWeight = FontWeight.Bold)
            Text("Status: ${summary.currentStatus ?: "Unknown"}")
            Text("Route: ${summary.routeCode ?: "Not assigned"}")
            Text("Container: ${summary.containerBarcode ?: "None"}")
            Text("Trailer: ${summary.trailerBarcode ?: "None"}")
        }
    }
}

@Composable
private fun StatusCard(message: String) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(message, modifier = Modifier.padding(12.dp), style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun MessageBanner(error: String?, notice: String?, onDismiss: () -> Unit) {
    val message = error ?: notice ?: return
    Surface(
        color = if (error != null) MaterialTheme.colorScheme.errorContainer
        else MaterialTheme.colorScheme.primaryContainer,
        onClick = onDismiss,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(
            message,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

private fun scannerTitle(target: ScannerTarget) = when (target) {
    ScannerTarget.BADGE -> "Scan employee badge"
    ScannerTarget.IDENTIFIER -> "Scan work identifier"
    ScannerTarget.CONTAINER -> "Scan container"
    ScannerTarget.TRAILER -> "Scan trailer"
    ScannerTarget.LOOKUP -> "Scan package"
}
