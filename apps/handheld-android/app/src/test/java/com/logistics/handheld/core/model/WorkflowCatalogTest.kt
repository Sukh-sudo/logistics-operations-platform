package com.logistics.handheld.core.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WorkflowCatalogTest {
    @Test
    fun `catalog exposes every documented handheld workflow`() {
        assertEquals(TaskType.entries.toSet(), WorkflowCatalog.tasks.map { it.type }.toSet())
        WorkflowCatalog.tasks.forEach { task ->
            assertTrue("${task.type} should define at least one action", task.actions.isNotEmpty())
            assertEquals(
                "${task.type} contains duplicate action buttons",
                task.actions.size,
                task.actions.map { it.action }.distinct().size,
            )
        }
    }

    @Test
    fun `authorization categories reveal only permitted tasks`() {
        val courier = WorkflowCatalog.authorized(listOf("COURIER_DELIVERY"))

        assertEquals(listOf(TaskType.COURIER_DELIVERY), courier.map { it.type })
        assertTrue(courier.single().actions.all { it.capturesLocation })
    }
}
