let ioInstance = null;

export const setSocketIo = (io) => {
  ioInstance = io;
};

export const getSocketIo = () => ioInstance;
