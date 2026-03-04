export const ADMIN_MONITOR_ROOM = "role:admin";

const normalizeId = (value) => String(value || "").trim();

export const userMonitorRoom = (userId) => `user:${normalizeId(userId)}`;

export const monitoringRoomsForOwner = (ownerUserId) => {
  const ownerId = normalizeId(ownerUserId);
  if (!ownerId) {
    return [ADMIN_MONITOR_ROOM];
  }

  return [ADMIN_MONITOR_ROOM, userMonitorRoom(ownerId)];
};

