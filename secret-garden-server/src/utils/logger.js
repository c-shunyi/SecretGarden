const normalizeMeta = (meta) => {
  if (meta instanceof Error) {
    return { message: meta.message, stack: meta.stack };
  }
  return meta;
};

const stringifyMeta = (meta) => {
  if (meta === undefined) {
    return '';
  }
  const normalized = normalizeMeta(meta);
  try {
    return ` ${JSON.stringify(normalized)}`;
  } catch (error) {
    return ' [unserializable meta]';
  }
};

const formatMessage = (message) => {
  if (typeof message === 'string') {
    return message;
  }
  try {
    return JSON.stringify(message);
  } catch (error) {
    return String(message);
  }
};

const log = (level, message, meta, output) => {
  const time = new Date().toISOString();
  const text = `[${time}] [${level}] ${formatMessage(message)}${stringifyMeta(meta)}`;
  output(text);
};

const Logger = {
  success(message, meta) {
    log('SUCCESS', message, meta, console.log);
  },
  info(message, meta) {
    log('INFO', message, meta, console.log);
  },
  warn(message, meta) {
    log('WARN', message, meta, console.warn);
  },
  error(message, meta) {
    log('ERROR', message, meta, console.error);
  },
  debug(message, meta) {
    if (process.env.NODE_ENV === 'production') {
      return;
    }
    log('DEBUG', message, meta, console.log);
  }
};

export default Logger;
