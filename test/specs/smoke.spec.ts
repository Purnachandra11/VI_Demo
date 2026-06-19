import { listDevices } from '../utils/adb';
import { getRunContext } from '../utils/env';

describe('Smoke — WDIO + Appium stack', () => {
  it('should see at least one ADB device', async () => {
    const devices = await listDevices();
    expect(devices.length).toBeGreaterThan(0);
  });

  it('should load run context from environment', async () => {
    const ctx = getRunContext();
    expect(ctx.aPartyDevice || process.env.APARTY_DEVICE).toBeTruthy();
  });
});
