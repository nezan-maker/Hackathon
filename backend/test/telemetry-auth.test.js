import test from "node:test";
import assert from "node:assert/strict";

import Pump from "../src/models/Pump.js";
import { Alert, F_Sensor, P_Sensor, S_Sensor, T_Sensor } from "../src/models/Sensor.js";
import { pumpTelemetry, telemetryOverview } from "../src/controllers/telemetryController.js";

const createMockRes = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

const createQuery = (result) => ({
  sort() {
    return this;
  },
  limit() {
    return this;
  },
  lean: async () => result,
});

test("telemetryOverview limits non-admin users to pumps owned by userId", async () => {
  const originalPumpFind = Pump.find;
  const originalPFind = P_Sensor.find;
  const originalFFind = F_Sensor.find;
  const originalTFind = T_Sensor.find;
  const originalSFind = S_Sensor.find;
  const originalAlertFind = Alert.find;

  let capturedPumpFilter = null;
  let capturedSensorFilter = null;
  let capturedAlertFilter = null;

  try {
    Pump.find = (filter) => {
      capturedPumpFilter = filter;
      return createQuery([
        {
          _id: "pump-1",
          name: "Pump 1",
          serial_id: "111111",
          userId: "user-1",
          purchasedAt: new Date().toISOString(),
          registeredAt: null,
        },
      ]);
    };
    P_Sensor.find = (filter) => {
      capturedSensorFilter = filter;
      return createQuery([]);
    };
    F_Sensor.find = (filter) => createQuery([]);
    T_Sensor.find = (filter) => createQuery([]);
    S_Sensor.find = (filter) => createQuery([]);
    Alert.find = (filter) => {
      capturedAlertFilter = filter;
      return createQuery([]);
    };

    const req = {
      query: { limit: "120" },
      user: { _id: "user-1", role: "user", email: "user@example.com" },
    };
    const res = createMockRes();

    await telemetryOverview(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedPumpFilter, {
      userId: { $exists: true, $ne: null },
    });
    assert.deepEqual(capturedSensorFilter, {
      pump_id: { $in: ["111111"] },
    });
    assert.deepEqual(capturedAlertFilter, {
      pump_id: { $in: ["111111"] },
    });
    assert.equal(Array.isArray(res.body?.pumps), true);
    assert.equal(res.body.pumps.length, 1);
  } finally {
    Pump.find = originalPumpFind;
    P_Sensor.find = originalPFind;
    F_Sensor.find = originalFFind;
    T_Sensor.find = originalTFind;
    S_Sensor.find = originalSFind;
    Alert.find = originalAlertFind;
  }
});

test("pumpTelemetry blocks non-admin access to another user's pump", async () => {
  const originalPumpFindOne = Pump.findOne;

  try {
    Pump.findOne = () =>
      createQuery({
        _id: "pump-1",
        serial_id: "222222",
        name: "Pump 2",
        capacity: 20,
        userId: "owner-2",
        purchasedAt: new Date().toISOString(),
        registeredAt: null,
      });

    const req = {
      params: { serial_id: "222222" },
      query: {},
      user: { _id: "user-1", role: "user", email: "user@example.com" },
    };
    const res = createMockRes();

    await pumpTelemetry(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, {
      message: "You can only view telemetry for pumps that you own",
    });
  } finally {
    Pump.findOne = originalPumpFindOne;
  }
});

test("pumpTelemetry allows admin to access all pumps", async () => {
  const originalPumpFindOne = Pump.findOne;
  const originalPFind = P_Sensor.find;
  const originalFFind = F_Sensor.find;
  const originalTFind = T_Sensor.find;
  const originalSFind = S_Sensor.find;

  try {
    Pump.findOne = () =>
      createQuery({
        _id: "pump-1",
        serial_id: "333333",
        name: "Pump 3",
        capacity: 30,
        userId: "owner-3",
        purchasedAt: new Date().toISOString(),
        registeredAt: null,
      });
    P_Sensor.find = () =>
      createQuery([{ pump_id: "333333", sensorValue: 90, createdAt: new Date().toISOString() }]);
    F_Sensor.find = () =>
      createQuery([{ pump_id: "333333", sensorValue: "12", createdAt: new Date().toISOString() }]);
    T_Sensor.find = () =>
      createQuery([{ pump_id: "333333", sensorValue: "40", createdAt: new Date().toISOString() }]);
    S_Sensor.find = () =>
      createQuery([{ pump_id: "333333", sensorValue: "1200", createdAt: new Date().toISOString() }]);

    const req = {
      params: { serial_id: "333333" },
      query: {},
      user: { _id: "admin-1", role: "admin", email: "admin@example.com" },
    };
    const res = createMockRes();

    await pumpTelemetry(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.pump?.serial_id, "333333");
    assert.equal(res.body?.latest?.pressure, 90);
  } finally {
    Pump.findOne = originalPumpFindOne;
    P_Sensor.find = originalPFind;
    F_Sensor.find = originalFFind;
    T_Sensor.find = originalTFind;
    S_Sensor.find = originalSFind;
  }
});
