import test from "node:test";
import assert from "node:assert/strict";

import Pump from "../src/models/Pump.js";
import { registerPump } from "../src/controllers/purchaseController.js";
import { adminConfirmPumpInstallation } from "../src/controllers/adminController.js";

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

const createFindOneSelect = (doc) => ({
  select: async () => doc,
});

test("registerPump blocks registration until user confirms installation", async () => {
  const originalFindOne = Pump.findOne;

  try {
    Pump.findOne = () =>
      createFindOneSelect({
        _id: "pump-1",
        serial_id: "123456",
        userId: "user-1",
        purchasedAt: new Date().toISOString(),
        registeredAt: null,
        installationConfirmedAt: null,
        adminInstallationConfirmedAt: null,
        installationConfirmationTokenHash: "token-hash",
      });

    const req = {
      body: { serial_id: "123456" },
      user: { _id: "user-1" },
    };
    const res = createMockRes();

    await registerPump(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, {
      message:
        "Complete installation from the confirmation email before registering this pump",
    });
  } finally {
    Pump.findOne = originalFindOne;
  }
});

test("registerPump blocks registration until admin confirms installation", async () => {
  const originalFindOne = Pump.findOne;

  try {
    Pump.findOne = () =>
      createFindOneSelect({
        _id: "pump-2",
        serial_id: "654321",
        userId: "user-1",
        purchasedAt: new Date().toISOString(),
        registeredAt: null,
        installationConfirmedAt: new Date().toISOString(),
        adminInstallationConfirmedAt: null,
        installationConfirmationTokenHash: null,
      });

    const req = {
      body: { serial_id: "654321" },
      user: { _id: "user-1" },
    };
    const res = createMockRes();

    await registerPump(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, {
      message:
        "Installation is waiting for admin confirmation before registration is allowed",
    });
  } finally {
    Pump.findOne = originalFindOne;
  }
});

test("registerPump allows registration only after user and admin confirmation", async () => {
  const originalFindOne = Pump.findOne;
  let saveCalled = false;

  try {
    const pumpDoc = {
      _id: "pump-3",
      serial_id: "777777",
      userId: "user-1",
      purchasedAt: new Date().toISOString(),
      registeredAt: null,
      installationConfirmedAt: new Date().toISOString(),
      adminInstallationConfirmedAt: new Date().toISOString(),
      installationConfirmationTokenHash: null,
      save: async function save() {
        saveCalled = true;
        return this;
      },
    };

    Pump.findOne = () => createFindOneSelect(pumpDoc);

    const req = {
      body: { serial_id: "777777" },
      user: { _id: "user-1" },
    };
    const res = createMockRes();

    await registerPump(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.message, "Pump successfully registered");
    assert.equal(saveCalled, true);
    assert.ok(pumpDoc.registeredAt instanceof Date);
  } finally {
    Pump.findOne = originalFindOne;
  }
});

test("adminConfirmPumpInstallation blocks admin approval before user confirmation", async () => {
  const originalFindOne = Pump.findOne;

  try {
    Pump.findOne = async () => ({
      _id: "pump-4",
      serial_id: "888888",
      purchasedAt: new Date().toISOString(),
      installationConfirmedAt: null,
      adminInstallationConfirmedAt: null,
    });

    const req = { params: { serial_id: "888888" } };
    const res = createMockRes();

    await adminConfirmPumpInstallation(req, res);

    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.body, {
      message:
        "User has not confirmed installation yet. Wait for user confirmation first.",
    });
  } finally {
    Pump.findOne = originalFindOne;
  }
});

test("adminConfirmPumpInstallation confirms installation after user confirmation", async () => {
  const originalFindOne = Pump.findOne;
  let saveCalled = false;

  try {
    const pumpDoc = {
      _id: "pump-5",
      serial_id: "999999",
      purchasedAt: new Date().toISOString(),
      installationConfirmedAt: new Date().toISOString(),
      adminInstallationConfirmedAt: null,
      save: async function save() {
        saveCalled = true;
        return this;
      },
    };

    Pump.findOne = async () => pumpDoc;

    const req = { params: { serial_id: "999999" } };
    const res = createMockRes();

    await adminConfirmPumpInstallation(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(
      res.body?.message,
      "Installation confirmed by admin. User can now register this pump.",
    );
    assert.equal(saveCalled, true);
    assert.ok(pumpDoc.adminInstallationConfirmedAt instanceof Date);
  } finally {
    Pump.findOne = originalFindOne;
  }
});
