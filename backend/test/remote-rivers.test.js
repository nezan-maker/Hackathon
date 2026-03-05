import test from "node:test";
import assert from "node:assert/strict";

import River from "../src/models/River.js";
import { nearestRiversController } from "../src/controllers/mqttController.js";

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
  lean: async () => result,
});

test("nearestRiversController returns the 5 nearest rivers sorted by distance", async () => {
  const originalFind = River.find;

  try {
    River.find = () =>
      createQuery([
        {
          _id: "river-1",
          river_id: 1,
          river_name: "Nearest River",
          lat: -2.03059,
          lon: 30.8622,
          discharge_id: 1,
          discharge_value: "0.10",
        },
        {
          _id: "river-2",
          river_id: 2,
          river_name: "Nearby River",
          lat: -2.05,
          lon: 30.88,
          discharge_id: 2,
          discharge_value: "0.20",
        },
        {
          _id: "river-3",
          river_id: 3,
          river_name: "River 3",
          lat: -2.1,
          lon: 30.9,
          discharge_id: 3,
          discharge_value: "0.30",
        },
        {
          _id: "river-4",
          river_id: 4,
          river_name: "River 4",
          lat: -2.2,
          lon: 30.75,
          discharge_id: 4,
          discharge_value: "0.40",
        },
        {
          _id: "river-5",
          river_id: 5,
          river_name: "River 5",
          lat: -1.95,
          lon: 30.95,
          discharge_id: 5,
          discharge_value: "0.50",
        },
        {
          _id: "river-6",
          river_id: 6,
          river_name: "Far River",
          lat: -3.1,
          lon: 31.9,
          discharge_id: 6,
          discharge_value: "0.60",
        },
      ]);

    const req = {
      user: {
        _id: "user-1",
        lat: -2.0305925,
        lon: 30.8622037,
      },
    };
    const res = createMockRes();

    await nearestRiversController(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(Array.isArray(res.body?.rivers), true);
    assert.equal(res.body.rivers.length, 5);
    assert.equal(res.body.rivers[0].river_name, "Nearest River");
    assert.equal(res.body.rivers.some((river) => river.river_name === "Far River"), false);
    assert.equal(
      res.body.rivers[0].distance_km <= res.body.rivers[1].distance_km,
      true,
    );
  } finally {
    River.find = originalFind;
  }
});

test("nearestRiversController returns 409 when session geolocation is missing", async () => {
  const req = {
    user: {
      _id: "user-1",
      lat: null,
      lon: null,
    },
  };
  const res = createMockRes();

  await nearestRiversController(req, res);

  assert.equal(res.statusCode, 409);
  assert.equal(
    res.body?.message,
    "Browser geolocation is required. Allow location access in your browser. Server fallback runs only when location permission is denied.",
  );
});

test("nearestRiversController prefers browser coordinates when provided", async () => {
  const originalFind = River.find;

  try {
    River.find = () =>
      createQuery([
        {
          _id: "river-1",
          river_id: 1,
          river_name: "Nearest River",
          lat: -2.03059,
          lon: 30.8622,
          discharge_id: 1,
          discharge_value: "0.10",
        },
      ]);

    let saveCallCount = 0;
    const req = {
      query: {
        lat: "-2.0305925",
        lon: "30.8622037",
      },
      user: {
        _id: "user-browser",
        lat: null,
        lon: null,
        async save() {
          saveCallCount += 1;
        },
      },
    };
    const res = createMockRes();

    await nearestRiversController(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.location_source, "browser");
    assert.equal(res.body?.user_location?.lat, -2.0305925);
    assert.equal(res.body?.user_location?.lon, 30.8622037);
    assert.equal(req.user.lat, -2.0305925);
    assert.equal(req.user.lon, 30.8622037);
    assert.equal(saveCallCount, 1);
  } finally {
    River.find = originalFind;
  }
});

test("nearestRiversController resolves missing session geolocation from request IP", async () => {
  const originalFind = River.find;
  const originalFetch = global.fetch;

  try {
    River.find = () =>
      createQuery([
        {
          _id: "river-1",
          river_id: 1,
          river_name: "Nearest River",
          lat: -2.03059,
          lon: 30.8622,
          discharge_id: 1,
          discharge_value: "0.10",
        },
      ]);

    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        success: true,
        latitude: -2.0305925,
        longitude: 30.8622037,
      }),
    });

    let saveCallCount = 0;
    const req = {
      headers: {
        "x-forwarded-for": "10.10.0.8, 8.8.8.8",
      },
      query: {
        browser_location_denied: "true",
      },
      user: {
        _id: "user-2",
        lat: null,
        lon: null,
        lastLoginIp: null,
        async save() {
          saveCallCount += 1;
        },
      },
    };
    const res = createMockRes();

    await nearestRiversController(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.location_source, "ip");
    assert.equal(Array.isArray(res.body?.rivers), true);
    assert.equal(res.body?.rivers?.length, 1);
    assert.equal(req.user.lat, -2.0305925);
    assert.equal(req.user.lon, 30.8622037);
    assert.equal(req.user.lastLoginIp, "8.8.8.8");
    assert.equal(saveCallCount, 1);
  } finally {
    River.find = originalFind;
    global.fetch = originalFetch;
  }
});
