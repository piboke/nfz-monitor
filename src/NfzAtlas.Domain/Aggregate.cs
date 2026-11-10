using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NfzAtlas.Domain;

public sealed record Aggregate(
    string Key,
    int Queues,
    int KnownAwaiting,
    long? AwaitingEntries,
    int KnownPcus,
    double? MedianPcusDays,
    int FreshQueues,
    double FreshPercent,
    int MatchedQueues,
    long? AwaitingChange,
    double? AwaitingChangePercent,
    double? MedianPcusChange,
    int RisingQueues,
    int FallingQueues
);
