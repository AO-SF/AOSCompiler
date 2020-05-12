// Syscall ids
#define SyscallIdExit 0
#define SyscallIdGetPid 1
#define SyscallIdArgc 2
#define SyscallIdArgvN 3
#define SyscallIdFork 4
#define SyscallIdExec 5
#define SyscallIdWaitPid 6
#define SyscallIdGetPidPath 7
#define SyscallIdGetPidState 8
#define SyscallIdGetAllCpuCounts 9
#define SyscallIdKill 10
#define SyscallIdGetPidRam 11
#define SyscallIdSignal 12
#define SyscallIdGetPidFdN 13
#define SyscallIdExec2 14

#define SyscallIdRead 256
#define SyscallIdWrite 257
#define SyscallIdOpen 258
#define SyscallIdClose 259
#define SyscallIdDirGetChildN 260
#define SyscallIdGetPath 261
#define SyscallIdResizeFile 262
#define SyscallIdGetFileLen 263
#define SyscallIdTryReadByte 264
#define SyscallIdIsDir 265
#define SyscallIdFileExists 266
#define SyscallIdDelete 267
#define SyscallIdRead32 268
#define SyscallIdWrite32 269
#define SyscallIdResizeFile32 270
#define SyscallIdGetFileLen32 271
#define SyscallIdAppend 272
#define SyscallIdFlush 273
#define SyscallIdTryWriteByte 274
#define SyscallIdGetPathGlobal 275

#define SyscallIdEnvGetPwd 514
#define SyscallIdEnvSetPwd 515
#define SyscallIdEnvGetPath 516
#define SyscallIdEnvSetPath 517

#define SyscallIdTimeMonotonic16s 768
#define SyscallIdTimeMonotonic16ms 769
#define SyscallIdTimeMonotonic32s 770
#define SyscallIdTimeMonotonic32ms 771
#define SyscallIdTimeReal32s 772
#define SyscallIdTimeToDate32s 773

#define SyscallIdRegisterSignalHandler 1024

#define SyscallIdShutdown 1280
#define SyscallIdMount 1281
#define SyscallIdUnmount 1282
#define SyscallIdIoctl 1283
#define SyscallIdGetLogLevel 1284
#define SyscallIdSetLogLevel 1285
#define SyscallIdPipeOpen 1286

#define SyscallIdStrChr 1536
#define SyscallIdStrChrNul 1537
#define SyscallIdMemMove 1538
#define SyscallIdMemCmp 1539
#define SyscallIdStrRChr 1540
#define SyscallIdStrCmp 1541

#define SyscallIdHwDeviceRegister 1792
#define SyscallIdHwDeviceDeregister 1793
#define SyscallIdHwDeviceGetType 1794
#define SyscallIdHwDeviceSdCardReaderMount 1795
#define SyscallIdHwDeviceSdCardReaderUnmount 1796
#define SyscallIdHwDeviceDht22GetTemperature 1797
#define SyscallIdHwDeviceDht22GetHumidity 1798

#define SyscallIdInt32Add16 2048
#define SyscallIdInt32Add32 2049
#define SyscallIdInt32Sub16 2050
#define SyscallIdInt32Sub32 2051
#define SyscallIdInt32Mul16 2052
#define SyscallIdInt32Mul32 2053
#define SyscallIdInt32Div16 2054
#define SyscallIdInt32Div32 2055
#define SyscallIdInt32Shl 2056
#define SyscallIdInt32Shr 2057

// Exec flags
#define SyscallExecPathFlagLiteral 0
#define SyscallExecPathFlagSearch 1

// WaitPid special return values
#define SyscallWaitpidStatusSuccess 0
#define SyscallWaitpidStatusInterrupted 65531
#define SyscallWaitpidStatusNoProcess 65532
#define SyscallWaitpidStatusKilled 65534
#define SyscallWaitpidStatusTimeout 65535

// HW device constants
#define SyscallHwDeviceIdMax 4

#define SyscallHwDeviceTypeUnused 0
#define SyscallHwDeviceTypeRaw 1
#define SyscallHwDeviceTypeSdCardReader 2
#define SyscallHwDeviceTypeDht22 3

// Mount type/format constants
#define SyscallMountFormatCustomMiniFs 0
#define SyscallMountFormatFlatFile 1
#define SyscallMountFormatPartition1 2
#define SyscallMountFormatPartition2 3
#define SyscallMountFormatPartition3 4
#define SyscallMountFormatPartition4 5
#define SyscallMountFormatCircBuf 6
