using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NfzAtlas.Domain;

public sealed record Observation(
    string Fingerprint,
    DateTimeOffset RetrievedAt,
    string SchemaVersion,
    QueueRow Queue,
    string? SourceFingerprint = null
);
