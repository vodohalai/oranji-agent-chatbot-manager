// Client-side helpers for Messenger integration (Admin UI)
/**
 * Tests the webhook connection.
 * In Phase 1, this will hit a mock endpoint that always returns success.
 */
export async function testWebhookConnection(): Promise<{ success: boolean; message: string }> {
  try {
    // This endpoint will be implemented in the worker in a later phase
    const response = await fetch('/api/messenger/test');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    return { success: data.success, message: data.message || 'Test successful!' };
  } catch (error) {
    console.error('Webhook test failed:', error);
    return { success: false, message: 'Failed to connect to the test endpoint.' };
  }
}
/**
 * Sends a test message via the webhook.
 * In Phase 1, this is a mock.
 * @param recipientId - The recipient's ID (e.g., PSID for Facebook)
 * @param message - The message text to send
 */
export async function sendTestMessage(recipientId: string, message: string): Promise<{ success: boolean; message: string }> {
  try {
    // This endpoint will be implemented in the worker in a later phase
    const response = await fetch('/api/messenger/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId, message }),
    });
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    return { success: data.success, message: data.message || 'Test message sent!' };
  } catch (error) {
    console.error('Sending test message failed:', error);
    return { success: false, message: 'Failed to send the test message.' };
  }
}