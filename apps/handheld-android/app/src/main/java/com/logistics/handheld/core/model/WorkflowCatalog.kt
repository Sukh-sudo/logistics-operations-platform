package com.logistics.handheld.core.model

enum class IdentifierKind { PACKAGE, CONTAINER, NONE }

data class ActionDefinition(
    val action: HandheldAction,
    val label: String,
    val instruction: String,
    val identifierKind: IdentifierKind,
    val needsContainer: Boolean = false,
    val needsTrailer: Boolean = false,
    val needsRouteAndTruck: Boolean = false,
    val capturesLocation: Boolean = false,
)

data class TaskDefinition(
    val type: TaskType,
    val category: String,
    val label: String,
    val description: String,
    val actions: List<ActionDefinition>,
)

/**
 * This catalog controls presentation and required fields only. Package,
 * container, trailer, and route decisions remain authoritative on the server.
 */
object WorkflowCatalog {
    val tasks = listOf(
        TaskDefinition(
            TaskType.TRAILER_LOAD,
            "TRAILER_OPERATIONS",
            "Load trailer",
            "Load packages or closed containers into a selected trailer.",
            listOf(
                action(HandheldAction.LOAD_PACKAGE_TO_TRAILER, "Load package", IdentifierKind.PACKAGE, trailer = true),
                action(HandheldAction.UNLOAD_PACKAGE_FROM_TRAILER, "Remove package", IdentifierKind.PACKAGE, trailer = true),
                action(HandheldAction.LOAD_CONTAINER_TO_TRAILER, "Load closed container", IdentifierKind.CONTAINER, trailer = true),
                action(HandheldAction.UNLOAD_CONTAINER_FROM_TRAILER, "Remove container", IdentifierKind.CONTAINER, trailer = true),
                action(HandheldAction.CLOSE_TRAILER, "Close trailer", IdentifierKind.NONE, trailer = true),
            ),
        ),
        TaskDefinition(
            TaskType.TRAILER_UNLOAD,
            "TRAILER_OPERATIONS",
            "Unload trailer",
            "Unload packages and containers from a selected inbound trailer.",
            listOf(
                action(HandheldAction.UNLOAD_PACKAGE_FROM_TRAILER, "Unload package", IdentifierKind.PACKAGE, trailer = true),
                action(HandheldAction.LOAD_PACKAGE_TO_TRAILER, "Restore package", IdentifierKind.PACKAGE, trailer = true),
                action(HandheldAction.UNLOAD_CONTAINER_FROM_TRAILER, "Unload container", IdentifierKind.CONTAINER, trailer = true),
                action(HandheldAction.LOAD_CONTAINER_TO_TRAILER, "Restore container", IdentifierKind.CONTAINER, trailer = true),
            ),
        ),
        TaskDefinition(
            TaskType.CONTAINER_LOAD,
            "TRAILER_OPERATIONS",
            "Load container",
            "Pair a package with its destination container.",
            listOf(
                action(HandheldAction.LOAD_PACKAGE_TO_CONTAINER, "Load package", IdentifierKind.PACKAGE, container = true),
                action(HandheldAction.UNLOAD_PACKAGE_FROM_CONTAINER, "Remove package", IdentifierKind.PACKAGE, container = true),
                action(HandheldAction.CLOSE_CONTAINER, "Close container", IdentifierKind.CONTAINER, container = true),
            ),
        ),
        TaskDefinition(
            TaskType.CONTAINER_UNLOAD,
            "TRAILER_OPERATIONS",
            "Unload container",
            "Remove or restore packages using paired scans.",
            listOf(
                action(HandheldAction.UNLOAD_PACKAGE_FROM_CONTAINER, "Unload package", IdentifierKind.PACKAGE, container = true),
                action(HandheldAction.LOAD_PACKAGE_TO_CONTAINER, "Restore package", IdentifierKind.PACKAGE, container = true),
            ),
        ),
        TaskDefinition(
            TaskType.LAST_MILE_LOADING,
            "LAST_MILE_LOADING",
            "Last-mile loading",
            "Load packages into a selected route and truck.",
            listOf(
                action(HandheldAction.LOAD_PACKAGE_TO_ROUTE, "Load package", IdentifierKind.PACKAGE, route = true),
                action(HandheldAction.REMOVE_PACKAGE_FROM_ROUTE, "Remove package", IdentifierKind.PACKAGE, route = true),
            ),
        ),
        TaskDefinition(
            TaskType.COURIER_DELIVERY,
            "COURIER_DELIVERY",
            "Courier delivery",
            "Record route milestones with best-effort GPS.",
            listOf(
                delivery(HandheldAction.PACKAGE_OUT_FOR_DELIVERY, "Out for delivery"),
                delivery(HandheldAction.PACKAGE_DELIVERED, "Delivered"),
                delivery(HandheldAction.PACKAGE_ATTEMPTED_DELIVERY, "Attempted"),
                delivery(HandheldAction.PACKAGE_DAMAGED, "Damaged"),
                delivery(HandheldAction.PACKAGE_MISROUTED, "Misrouted"),
                delivery(HandheldAction.PACKAGE_RETURNED_TO_TERMINAL, "Return to terminal"),
            ),
        ),
    )

    fun authorized(categories: List<String>) = tasks.filter { it.category in categories }
    fun task(type: TaskType) = requireNotNull(tasks.find { it.type == type })

    private fun action(
        action: HandheldAction,
        label: String,
        kind: IdentifierKind,
        container: Boolean = false,
        trailer: Boolean = false,
        route: Boolean = false,
    ) = ActionDefinition(
        action,
        label,
        when (kind) {
            IdentifierKind.PACKAGE -> "Scan the next package"
            IdentifierKind.CONTAINER -> "Scan the container"
            IdentifierKind.NONE -> "Confirm this action"
        },
        kind,
        needsContainer = container,
        needsTrailer = trailer,
        needsRouteAndTruck = route,
    )

    private fun delivery(action: HandheldAction, label: String) =
        ActionDefinition(
            action,
            label,
            "Scan the package",
            IdentifierKind.PACKAGE,
            needsRouteAndTruck = true,
            capturesLocation = true,
        )
}
